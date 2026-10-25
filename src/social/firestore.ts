// FirestoreBackend — real multiplayer. Runs in the offscreen document (extension origin),
// so anonymous auth persists across every website.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import * as socialAI from '@/ai/socialAI';
import { addPendingFriendChallenge } from '@/core/lockdown';
import * as store from '@/core/storage';
import { uid } from '@/core/util';
import { DEMO_FRIENDS } from '@/data/demo';
import { SocialBackend, genCode } from './backend';
import { boardMovePatch, initialGameFields } from './boardGames';
import type { Friend, FriendRequest, GameInvite, GameKind, GamePlayer, GameState, Me, Nudge, RoomState } from './types';
import { isValidGuess, randomWord, score } from './words';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

export function firebaseConfigFromEnv(): FirebaseConfig | null {
  const apiKey = import.meta.env.WXT_FIREBASE_API_KEY as string | undefined;
  const authDomain = import.meta.env.WXT_FIREBASE_AUTH_DOMAIN as string | undefined;
  const projectId = import.meta.env.WXT_FIREBASE_PROJECT_ID as string | undefined;
  const appId = import.meta.env.WXT_FIREBASE_APP_ID as string | undefined;
  if (!apiKey || !projectId || !appId) return null;
  return { apiKey, authDomain: authDomain || `${projectId}.firebaseapp.com`, projectId, appId };
}

interface UserDoc {
  name: string;
  code: string;
  characterId: Me['characterId'];
  topic: string;
  status: Friend['status'];
  focusMsToday: number;
  lastSeen: number;
  friends: string[];
}

export class FirestoreBackend extends SocialBackend {
  private app: FirebaseApp;
  private db: Firestore;
  private user!: User;
  private unsubs: Unsubscribe[] = [];
  private friendUnsub: Unsubscribe | null = null;
  private roomUnsub: Unsubscribe | null = null;
  private gameUnsub: Unsubscribe | null = null;
  private queueUnsub: Unsubscribe | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private matchTimer: ReturnType<typeof setTimeout> | null = null;
  private aiReplyInFlight = false;

  constructor(me: Me, cfg: FirebaseConfig) {
    super(me);
    this.app = initializeApp(cfg);
    this.db = getFirestore(this.app);
  }

  static async connect(cfg: FirebaseConfig, seedMe: Me): Promise<FirestoreBackend> {
    const be = new FirestoreBackend({ ...seedMe, mode: 'firebase', ready: false }, cfg);
    const auth = getAuth(be.app);
    const user = await new Promise<User>((resolve, reject) => {
      const un = onAuthStateChanged(
        auth,
        (u) => {
          if (u) {
            un();
            resolve(u);
          } else signInAnonymously(auth).catch(reject);
        },
        reject,
      );
    });
    be.user = user;
    await be.init();
    await be.bootstrapUser();
    be.attachListeners();
    return be;
  }

  private userRef(u = this.user.uid) {
    return doc(this.db, 'users', u);
  }

  private async bootstrapUser() {
    const ref = this.userRef();
    const snap = await getDoc(ref);
    let code = (snap.data() as UserDoc | undefined)?.code;
    if (!code) {
      code = genCode();
      await setDoc(doc(this.db, 'codes', code), { uid: this.user.uid });
    }
    const name = this.settings.displayName || this.me.name;
    const data: UserDoc = {
      name,
      code,
      characterId: this.settings.characterId,
      topic: this.settings.topic,
      status: this.myStatus(),
      focusMsToday: this.myFocusMs(),
      lastSeen: Date.now(),
      friends: (snap.data() as UserDoc | undefined)?.friends ?? [],
    };
    await setDoc(ref, data, { merge: true });
    await this.pushMe({ uid: this.user.uid, name, code, mode: 'firebase', ready: true });
    this.heartbeat = setInterval(() => void this.onPresenceChanged(), 30_000);
  }

  protected async onPresenceChanged() {
    if (!this.me.ready) return;
    try {
      await updateDoc(this.userRef(), {
        status: this.myStatus(),
        focusMsToday: this.myFocusMs(),
        lastSeen: Date.now(),
        topic: this.settings.topic,
        characterId: this.settings.characterId,
      });
    } catch (e) {
      console.warn('[social] presence update failed', e);
    }
  }

  private attachListeners() {
    const me = this.user.uid;
    // my user doc → friends list
    this.unsubs.push(
      onSnapshot(this.userRef(), (snap) => {
        const d = snap.data() as UserDoc | undefined;
        if (!d) return;
        void this.watchFriends(d.friends ?? []);
      }),
    );
    // incoming friend requests
    this.unsubs.push(
      onSnapshot(query(collection(this.db, 'requests'), where('to', '==', me), where('status', '==', 'pending')), (qs) => {
        this.requests = qs.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FriendRequest, 'id'>) }));
        void this.mirror('social.requests', this.requests);
      }),
    );
    // nudges
    this.unsubs.push(
      onSnapshot(query(collection(this.db, 'nudges'), where('to', '==', me)), (qs) => {
        this.nudges = qs.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Nudge, 'id'>) })).filter((n) => Date.now() - n.at < 10 * 60_000);
        void this.mirror('social.nudges', this.nudges);
      }),
    );
    // challenges addressed to me → pending lockdown challenges
    this.unsubs.push(
      onSnapshot(query(collection(this.db, 'challenges'), where('to', '==', me), where('status', '==', 'pending')), (qs) => {
        for (const d of qs.docs) {
          const c = d.data() as { from: string; fromName: string; prompt: string; answers: string[]; at: number };
          void addPendingFriendChallenge({ challengeId: d.id, fromId: c.from, fromName: c.fromName, prompt: c.prompt, answers: c.answers, at: c.at }).then(() =>
            updateDoc(d.ref, { status: 'delivered' }),
          );
        }
      }),
    );
    // game invites
    this.unsubs.push(
      onSnapshot(query(collection(this.db, 'invites'), where('to', '==', me)), (qs) => {
        this.invites = qs.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GameInvite, 'id'>) })).filter((i) => Date.now() - i.at < 10 * 60_000);
        void this.mirror('social.invites', this.invites);
      }),
    );
  }

  private async watchFriends(uids: string[]) {
    this.friendUnsub?.();
    this.friendUnsub = null;
    if (!uids.length) {
      this.friends = [];
      await this.pushFriends();
      return;
    }
    const ids = uids.slice(0, 30);
    this.friendUnsub = onSnapshot(query(collection(this.db, 'users'), where(documentId(), 'in', ids)), (qs) => {
      this.friends = qs.docs.map((d) => {
        const u = d.data() as UserDoc;
        const stale = Date.now() - (u.lastSeen ?? 0) > 90_000;
        return {
          uid: d.id,
          name: u.name,
          code: u.code,
          characterId: u.characterId ?? 'red',
          status: stale ? 'offline' : u.status ?? 'offline',
          focusMsToday: u.focusMsToday ?? 0,
          topic: u.topic ?? '',
          lastSeen: u.lastSeen ?? 0,
        } satisfies Friend;
      });
      void this.pushFriends();
    });
  }

  // ---------------- friends
  async setName(name: string) {
    await updateDoc(this.userRef(), { name });
    await this.pushMe({ name });
    await store.update('settings', { displayName: name });
  }
  async addFriendByCode(code: string) {
    if (code === this.me.code) return { ok: false, message: 'That is your own code, scholar.' };
    const snap = await getDoc(doc(this.db, 'codes', code));
    if (!snap.exists()) return { ok: false, message: `No one answers to ${code}.` };
    const to = (snap.data() as { uid: string }).uid;
    if (this.friends.some((f) => f.uid === to)) return { ok: false, message: 'Already friends!' };
    await addDoc(collection(this.db, 'requests'), {
      from: this.user.uid,
      fromName: this.me.name,
      fromCharacter: this.me.characterId,
      to,
      status: 'pending',
      at: Date.now(),
    });
    return { ok: true, message: 'Invitation sent by carrier pigeon.' };
  }
  async respondRequest(id: string, accept: boolean) {
    const ref = doc(this.db, 'requests', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const { from } = snap.data() as { from: string };
    if (accept) {
      await updateDoc(this.userRef(), { friends: arrayUnion(from) });
      await updateDoc(this.userRef(from), { friends: arrayUnion(this.user.uid) });
    }
    await updateDoc(ref, { status: accept ? 'accepted' : 'declined' });
  }
  async removeFriend(target: string) {
    await updateDoc(this.userRef(), { friends: arrayRemove(target) });
    await updateDoc(this.userRef(target), { friends: arrayRemove(this.user.uid) }).catch(() => {});
  }
  async nudge(to: string) {
    if (to.startsWith('demo-')) return;
    await addDoc(collection(this.db, 'nudges'), { from: this.user.uid, fromName: this.me.name, to, at: Date.now() });
  }
  async sendChallenge(to: string, prompt?: string, answers?: string[], generate?: boolean) {
    if (to.startsWith('demo-')) {
      // Demo friend: it "sends one back" right away so the lockdown demo can show a friend's challenge
      const demo = DEMO_FRIENDS.find((f) => f.uid === to);
      const ch = await this.generateChallengeFor(demo?.name ?? 'a friend', prompt, answers, generate);
      await addPendingFriendChallenge({ challengeId: to + '-' + Date.now(), fromId: to, fromName: demo?.name ?? 'A friend', prompt: ch.prompt, answers: ch.answers, at: Date.now() });
      return { prompt: ch.prompt, provider: ch.provider };
    }
    const target = this.friends.find((f) => f.uid === to);
    const ch = await this.generateChallengeFor(target?.name ?? 'a friend', prompt, answers, generate);
    await addDoc(collection(this.db, 'challenges'), {
      from: this.user.uid,
      fromName: this.me.name,
      to,
      prompt: ch.prompt,
      answers: ch.answers,
      status: 'pending',
      at: Date.now(),
    });
    return { prompt: ch.prompt, provider: ch.provider };
  }

  // ---------------- rooms
  private watchRoom(id: string) {
    this.roomUnsub?.();
    this.roomUnsub = onSnapshot(doc(this.db, 'rooms', id), (snap) => {
      if (!snap.exists()) {
        this.room = null;
        void this.pushRoom();
        return;
      }
      this.room = { id: snap.id, ...(snap.data() as Omit<RoomState, 'id'>) };
      void this.pushRoom();
      void this.maybeHostReply();
    });
  }
  private async maybeHostReply() {
    const r = this.room;
    if (!r || r.hostUid !== this.user.uid || this.aiReplyInFlight) return;
    const last = r.messages[r.messages.length - 1];
    if (!last || last.isAI) return;
    this.aiReplyInFlight = true;
    try {
      await updateDoc(doc(this.db, 'rooms', r.id), { aiBusy: true });
      const res = await socialAI.groupReply(r.topic, r.members.map((m) => m.name), r.messages.map((m) => ({ name: m.name, text: m.text, isAI: m.isAI })));
      await updateDoc(doc(this.db, 'rooms', r.id), {
        aiBusy: false,
        messages: arrayUnion({ id: uid(), uid: 'ai', name: 'Study Spirit', text: res.data, isAI: true, provider: res.provider, at: Date.now() }),
      });
    } catch (e) {
      console.warn('[social] group reply failed', e);
      await updateDoc(doc(this.db, 'rooms', r.id), { aiBusy: false }).catch(() => {});
    } finally {
      this.aiReplyInFlight = false;
    }
  }
  async createRoom() {
    const room: Omit<RoomState, 'id'> = {
      code: genCode(),
      topic: this.settings.topic || 'study',
      hostUid: this.user.uid,
      members: [{ uid: this.user.uid, name: this.me.name, characterId: this.me.characterId }],
      messages: [],
      flashcards: [],
      quiz: [],
    };
    const ref = await addDoc(collection(this.db, 'rooms'), room);
    await setDoc(doc(this.db, 'roomCodes', room.code), { roomId: ref.id });
    this.watchRoom(ref.id);
  }
  async joinRoom(code: string) {
    const snap = await getDoc(doc(this.db, 'roomCodes', code));
    if (!snap.exists()) return { ok: false, message: `No room answers to ${code}.` };
    const { roomId } = snap.data() as { roomId: string };
    await updateDoc(doc(this.db, 'rooms', roomId), {
      members: arrayUnion({ uid: this.user.uid, name: this.me.name, characterId: this.me.characterId }),
    });
    this.watchRoom(roomId);
    return { ok: true, message: 'Joined.' };
  }
  async leaveRoom() {
    const r = this.room;
    this.roomUnsub?.();
    this.roomUnsub = null;
    this.room = null;
    await this.pushRoom();
    if (r) {
      const meMember = r.members.find((m) => m.uid === this.user.uid);
      if (meMember) await updateDoc(doc(this.db, 'rooms', r.id), { members: arrayRemove(meMember) }).catch(() => {});
    }
  }
  async roomMessage(text: string) {
    if (!this.room || !text) return;
    await updateDoc(doc(this.db, 'rooms', this.room.id), {
      messages: arrayUnion({ id: uid(), uid: this.user.uid, name: this.me.name, text, at: Date.now() }),
    });
  }
  async roomFlashcards(notes: string) {
    if (!this.room) return;
    const id = this.room.id;
    await updateDoc(doc(this.db, 'rooms', id), { aiBusy: true });
    const r = await socialAI.generateFlashcards(this.room.topic, notes, 6);
    await updateDoc(doc(this.db, 'rooms', id), { aiBusy: false, flashcards: r.data, flashcardsProvider: r.provider });
  }
  async roomQuiz() {
    if (!this.room) return;
    const id = this.room.id;
    await updateDoc(doc(this.db, 'rooms', id), { aiBusy: true });
    const r = await socialAI.generateQuiz(this.room.topic, 3, 'medium');
    await updateDoc(doc(this.db, 'rooms', id), { aiBusy: false, quiz: r.data, quizProvider: r.provider });
  }

  // ---------------- tavern: matchmaking + game
  private watchGame(id: string) {
    this.gameUnsub?.();
    this.gameUnsub = onSnapshot(doc(this.db, 'games', id), (snap) => {
      if (!snap.exists()) {
        this.game = null;
        void this.pushGame();
        return;
      }
      this.game = { id: snap.id, ...(snap.data() as Omit<GameState, 'id'>) };
      void this.pushGame();
    });
  }
  private myPlayer(): GamePlayer {
    return { uid: this.user.uid, name: this.me.name, characterId: this.me.characterId, guesses: [], solvedAt: null };
  }
  private async createGameDoc(kind: GameKind, opponent: GamePlayer, opponentIsFriend: boolean, opponentTopic = ''): Promise<string> {
    const game: Omit<GameState, 'id'> = {
      ...initialGameFields(kind, randomWord),
      players: [this.myPlayer(), opponent],
      status: 'playing',
      winnerUid: null,
      startedAt: Date.now(),
      chat: [],
      opponentUid: opponent.uid,
      opponentIsFriend,
    };
    const ref = await addDoc(collection(this.db, 'games'), game);
    void socialAI.icebreaker(this.settings.topic, opponentTopic).then((r) =>
      updateDoc(ref, { icebreaker: r.data, icebreakerProvider: r.provider }).catch(() => {}),
    );
    return ref.id;
  }

  async findStranger(kind: GameKind) {
    const me = this.user.uid;
    await this.pushQueue({ status: 'waiting', since: Date.now(), message: 'Searching the tavern…' });
    await setDoc(doc(this.db, 'queue', me), { uid: me, name: this.me.name, characterId: this.me.characterId, topic: this.settings.topic, kind, status: 'waiting', at: Date.now(), gameId: null });

    // Listen to my own queue doc: someone may match me.
    this.queueUnsub?.();
    this.queueUnsub = onSnapshot(doc(this.db, 'queue', me), (snap) => {
      const d = snap.data() as { status: string; gameId: string | null } | undefined;
      if (d?.status === 'matched' && d.gameId) {
        this.clearMatchTimer();
        this.queueUnsub?.();
        this.queueUnsub = null;
        this.watchGame(d.gameId);
        void this.pushQueue({ status: 'matched', since: Date.now() });
      }
    });

    // Try to match with someone already waiting
    const qs = await getDocs(query(collection(this.db, 'queue'), where('status', '==', 'waiting'), limit(25)));
    const candidate = qs.docs
      .map((d) => d.data() as { uid: string; name: string; characterId: GamePlayer['characterId']; topic: string; kind?: GameKind; at: number })
      .filter((c) => c.uid !== me && (c.kind ?? 'spellbound') === kind && Date.now() - c.at < 2 * 60_000)[0];
    if (candidate) {
      try {
        const gameId = await runTransaction(this.db, async (tx) => {
          const theirs = await tx.get(doc(this.db, 'queue', candidate.uid));
          const mine = await tx.get(doc(this.db, 'queue', me));
          if (theirs.data()?.status !== 'waiting' || mine.data()?.status !== 'waiting') return null;
          const gameRef = doc(collection(this.db, 'games'));
          const opponent: GamePlayer = { uid: candidate.uid, name: candidate.name, characterId: candidate.characterId ?? 'red', guesses: [], solvedAt: null };
          const game: Omit<GameState, 'id'> = {
            ...initialGameFields(kind, randomWord),
            players: [this.myPlayer(), opponent],
            status: 'playing',
            winnerUid: null,
            startedAt: Date.now(),
            chat: [],
            opponentUid: candidate.uid,
            opponentIsFriend: false,
          };
          tx.set(gameRef, game);
          tx.update(doc(this.db, 'queue', candidate.uid), { status: 'matched', gameId: gameRef.id });
          tx.update(doc(this.db, 'queue', me), { status: 'matched', gameId: gameRef.id });
          return gameRef.id;
        });
        if (gameId) {
          void socialAI.icebreaker(this.settings.topic, candidate.topic).then((r) =>
            updateDoc(doc(this.db, 'games', gameId), { icebreaker: r.data, icebreakerProvider: r.provider }).catch(() => {}),
          );
          return;
        }
      } catch (e) {
        console.warn('[social] match tx failed', e);
      }
    }
    // Demo insurance: a bot shows up if nobody does
    if (this.settings.demoMode) {
      this.matchTimer = setTimeout(async () => {
        if (this.queue.status !== 'waiting') return;
        await this.cancelFind();
        await this.startBotGame(kind, false);
      }, 6000);
    }
  }
  private clearMatchTimer() {
    if (this.matchTimer) clearTimeout(this.matchTimer);
    this.matchTimer = null;
  }
  async cancelFind() {
    this.clearMatchTimer();
    this.queueUnsub?.();
    this.queueUnsub = null;
    await deleteDoc(doc(this.db, 'queue', this.user.uid)).catch(() => {});
    await this.pushQueue({ status: 'idle', since: 0 });
  }
  async inviteFriendToGame(to: string, kind: GameKind) {
    if (to.startsWith('demo-')) {
      await this.startBotGame(kind, true);
      return;
    }
    const f = this.friends.find((x) => x.uid === to);
    if (!f) return;
    const gameId = await this.createGameDoc(kind, { uid: f.uid, name: f.name, characterId: f.characterId, guesses: [], solvedAt: null }, true, f.topic);
    await addDoc(collection(this.db, 'invites'), { from: this.user.uid, fromName: this.me.name, to, gameId, kind, at: Date.now() });
    this.watchGame(gameId);
    await this.pushQueue({ status: 'matched', since: Date.now(), message: `Waiting for ${f.name} to accept…` });
  }
  async acceptInvite(id: string) {
    const inv = this.invites.find((i) => i.id === id);
    if (!inv) return;
    await deleteDoc(doc(this.db, 'invites', id)).catch(() => {});
    this.watchGame(inv.gameId);
    await this.pushQueue({ status: 'matched', since: Date.now() });
  }
  async guess(word: string) {
    if (this.game && this.game.id.startsWith('local-')) {
      const err = this.applyGuess(this.me.uid, word);
      if (err) return { ok: false, message: err };
      await this.pushGame();
      return { ok: true };
    }
    if (!this.game) return { ok: false, message: 'No game.' };
    if (!isValidGuess(word)) return { ok: false, message: 'Five letters, scholar.' };
    const ref = doc(this.db, 'games', this.game.id);
    const me = this.user.uid;
    try {
      await runTransaction(this.db, async (tx) => {
        const snap = await tx.get(ref);
        const g = snap.data() as Omit<GameState, 'id'>;
        if (g.status !== 'playing') throw new Error('Game is over.');
        const players = g.players.map((p) => ({ ...p }));
        const p = players.find((x) => x.uid === me);
        if (!p) throw new Error('Not in this game.');
        if (p.solvedAt !== null || p.guesses.length >= 6) throw new Error('Out of guesses.');
        const marks = score(word, g.word);
        p.guesses = [...p.guesses, { word, marks }];
        if (marks.every((m) => m === 'g')) p.solvedAt = Date.now();
        else if (p.guesses.length >= 6) p.failed = true;
        const solved = players.filter((x) => x.solvedAt !== null).sort((a, b) => a.solvedAt! - b.solvedAt!);
        const allDone = players.every((x) => x.solvedAt !== null || x.failed || x.guesses.length >= 6);
        const patch: Partial<GameState> = { players };
        if (solved.length || allDone) {
          patch.status = 'finished';
          patch.winnerUid = solved[0]?.uid ?? null;
        }
        tx.update(ref, patch);
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }
  async move(index: number) {
    if (!this.game) return { ok: false, message: 'No game.' };
    if (this.game.id.startsWith('local-')) return this.localMove(index);
    const ref = doc(this.db, 'games', this.game.id);
    const me = this.user.uid;
    try {
      await runTransaction(this.db, async (tx) => {
        const snap = await tx.get(ref);
        const r = boardMovePatch(snap.data() as Omit<GameState, 'id'>, me, index);
        if ('error' in r) throw new Error(r.error);
        tx.update(ref, r.patch);
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }
  async gameChat(text: string) {
    if (!this.game || !text) return;
    if (this.game.id.startsWith('local-')) {
      this.game = { ...this.game, chat: [...this.game.chat, { id: uid(), uid: this.me.uid, name: this.me.name, text, at: Date.now() }] };
      await this.pushGame();
      return;
    }
    await updateDoc(doc(this.db, 'games', this.game.id), { chat: arrayUnion({ id: uid(), uid: this.user.uid, name: this.me.name, text, at: Date.now() }) });
  }
  async leaveGame() {
    this.stopBot();
    this.clearMatchTimer();
    this.gameUnsub?.();
    this.gameUnsub = null;
    this.game = null;
    await this.pushGame();
    await this.cancelFind();
  }
  async addFriendFromGame() {
    const g = this.game;
    if (!g) return { ok: false, message: 'No game.' };
    const opp = g.players.find((p) => p.uid !== this.user.uid);
    if (!opp) return { ok: false, message: 'No opponent.' };
    if (opp.isBot || g.id.startsWith('local-')) {
      const f: Friend = { uid: opp.uid, name: opp.name, characterId: opp.characterId, status: 'break', focusMsToday: 38 * 60000, topic: 'Medieval Literature', lastSeen: Date.now(), isDemo: true };
      if (!this.friends.some((x) => x.uid === f.uid)) this.friends = [...this.friends, f];
      await this.pushFriends();
      return { ok: true, message: `${f.name} is now your friend.` };
    }
    await addDoc(collection(this.db, 'requests'), { from: this.user.uid, fromName: this.me.name, fromCharacter: this.me.characterId, to: opp.uid, status: 'pending', at: Date.now() });
    return { ok: true, message: `Friend request sent to ${opp.name}.` };
  }
}
