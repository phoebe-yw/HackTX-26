// Social backend base + Local (offline / demo) implementation. Runs in the offscreen document.
// Mirrors all live state into chrome.storage.session so widgets can subscribe.
import * as socialAI from '@/ai/socialAI';
import { addPendingFriendChallenge } from '@/core/lockdown';
import { isFocusing } from '@/core/session';
import * as store from '@/core/storage';
import type { MoodState, SessionState, Settings } from '@/core/types';
import { uid } from '@/core/util';
import { DEMO_FRIENDS, DEMO_STRANGER } from '@/data/demo';
import { pick } from '@/data/characters';
import { BOT_LINES, botNextGuess } from './bot';
import {
  SK,
  type Friend,
  type FriendRequest,
  type GameInvite,
  type GameState,
  type Me,
  type Nudge,
  type PresenceStatus,
  type QueueState,
  type RoomState,
  type SocialCmd,
} from './types';
import { isValidGuess, randomWord, score } from './words';

export function genCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

export function presenceFor(session: SessionState, mood: MoodState): PresenceStatus {
  if (session.status === 'idle') return 'offline';
  if (session.status !== 'focus') return 'break';
  if (!isFocusing(session)) return 'break';
  return mood.level >= 2 ? 'distracted' : 'focusing';
}

export abstract class SocialBackend {
  me: Me;
  friends: Friend[] = [];
  requests: FriendRequest[] = [];
  nudges: Nudge[] = [];
  invites: GameInvite[] = [];
  room: RoomState | null = null;
  game: GameState | null = null;
  queue: QueueState = { status: 'idle', since: 0 };
  settings!: Settings;
  session!: SessionState;
  mood!: MoodState;
  protected botTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(me: Me) {
    this.me = me;
  }

  async init() {
    const { settings, session, mood } = await store.getMany(['settings', 'session', 'mood']);
    this.settings = settings;
    this.session = session;
    this.mood = mood;
    store.watch('settings', (s) => {
      const demoChanged = s.demoMode !== this.settings.demoMode;
      this.settings = s;
      this.me = { ...this.me, characterId: s.characterId };
      if (demoChanged) void this.pushFriends();
      void this.onPresenceChanged();
    });
    store.watch('session', (s) => {
      this.session = s;
      void this.onPresenceChanged();
    });
    store.watch('mood', (m) => {
      const changed = m.level !== this.mood.level;
      this.mood = m;
      if (changed) void this.onPresenceChanged();
    });
    await this.mirrorAll();
  }

  // ---- mirroring
  protected async mirror(key: string, value: unknown) {
    await store.setSession(key, value);
  }
  async mirrorAll() {
    await Promise.all([
      this.mirror(SK.me, this.me),
      this.pushFriends(),
      this.mirror(SK.requests, this.requests),
      this.mirror(SK.nudges, this.nudges),
      this.mirror(SK.invites, this.invites),
      this.mirror(SK.room, this.room),
      this.mirror(SK.game, this.game),
      this.mirror(SK.queue, this.queue),
    ]);
  }
  protected async pushFriends() {
    const list = this.settings?.demoMode ? [...this.friends, ...DEMO_FRIENDS.map((f) => ({ ...f, lastSeen: Date.now() }))] : this.friends;
    await this.mirror(SK.friends, list);
  }
  protected async pushRoom() {
    await this.mirror(SK.room, this.room);
  }
  protected async pushGame() {
    await this.mirror(SK.game, this.game);
  }
  protected async pushQueue(q: QueueState) {
    this.queue = q;
    await this.mirror(SK.queue, q);
  }
  protected async pushMe(patch: Partial<Me>) {
    this.me = { ...this.me, ...patch };
    await this.mirror(SK.me, this.me);
  }

  myStatus(): PresenceStatus {
    return presenceFor(this.session, this.mood);
  }
  myFocusMs(): number {
    const s = this.session;
    return s.focusMsToday + (s.status === 'focus' && !s.paused ? Date.now() - s.phaseStartedAt : 0);
  }

  protected abstract onPresenceChanged(): Promise<void>;

  // ---- command dispatch
  async handle(c: SocialCmd): Promise<unknown> {
    switch (c.cmd) {
      case 'ping':
        await this.mirrorAll();
        return this.me;
      case 'setName':
        return this.setName(c.name.trim().slice(0, 24));
      case 'addFriendByCode':
        return this.addFriendByCode(c.code.trim().toUpperCase());
      case 'respondRequest':
        return this.respondRequest(c.id, c.accept);
      case 'removeFriend':
        return this.removeFriend(c.uid);
      case 'nudge':
        return this.nudge(c.uid);
      case 'dismissNudge':
        this.nudges = this.nudges.filter((n) => n.id !== c.id);
        return this.mirror(SK.nudges, this.nudges);
      case 'sendChallenge':
        return this.sendChallenge(c.uid, c.prompt, c.answers, c.generate);
      case 'createRoom':
        return this.createRoom();
      case 'joinRoom':
        return this.joinRoom(c.code.trim().toUpperCase());
      case 'leaveRoom':
        return this.leaveRoom();
      case 'roomMessage':
        return this.roomMessage(c.text.trim());
      case 'roomFlashcards':
        return this.roomFlashcards(c.notes ?? '');
      case 'roomQuiz':
        return this.roomQuiz();
      case 'findStranger':
        return this.findStranger();
      case 'cancelFind':
        return this.cancelFind();
      case 'inviteFriendToGame':
        return this.inviteFriendToGame(c.uid);
      case 'acceptInvite':
        return this.acceptInvite(c.id);
      case 'guess':
        return this.guess(c.word.trim().toLowerCase());
      case 'gameChat':
        return this.gameChat(c.text.trim());
      case 'leaveGame':
        return this.leaveGame();
      case 'addFriendFromGame':
        return this.addFriendFromGame();
    }
  }

  abstract setName(name: string): Promise<void>;
  abstract addFriendByCode(code: string): Promise<{ ok: boolean; message: string }>;
  abstract respondRequest(id: string, accept: boolean): Promise<void>;
  abstract removeFriend(uid: string): Promise<void>;
  abstract nudge(uid: string): Promise<void>;
  abstract sendChallenge(uid: string, prompt?: string, answers?: string[], generate?: boolean): Promise<{ prompt: string; provider: string }>;
  abstract createRoom(): Promise<void>;
  abstract joinRoom(code: string): Promise<{ ok: boolean; message: string }>;
  abstract leaveRoom(): Promise<void>;
  abstract roomMessage(text: string): Promise<void>;
  abstract roomFlashcards(notes: string): Promise<void>;
  abstract roomQuiz(): Promise<void>;
  abstract findStranger(): Promise<void>;
  abstract cancelFind(): Promise<void>;
  abstract inviteFriendToGame(uid: string): Promise<void>;
  abstract acceptInvite(id: string): Promise<void>;
  abstract guess(word: string): Promise<{ ok: boolean; message?: string }>;
  abstract gameChat(text: string): Promise<void>;
  abstract leaveGame(): Promise<void>;
  abstract addFriendFromGame(): Promise<{ ok: boolean; message: string }>;

  // ---- shared helpers used by both backends
  protected async generateChallengeFor(toName: string, prompt?: string, answers?: string[], generate?: boolean) {
    if (!generate && prompt && answers?.length) return { prompt, answers, provider: 'you' };
    const r = await socialAI.generateChallenge(this.me.name, toName, this.settings.topic);
    return { prompt: r.data.prompt, answers: r.data.answers, provider: r.provider };
  }

  /** Create a local game vs the demo bot. */
  protected async startBotGame(opponentIsFriend = false) {
    this.stopBot();
    const word = randomWord();
    const game: GameState = {
      id: 'local-' + uid(),
      word,
      players: [
        { uid: this.me.uid, name: this.me.name, characterId: this.me.characterId, guesses: [], solvedAt: null },
        { uid: DEMO_STRANGER.uid, name: DEMO_STRANGER.name, characterId: DEMO_STRANGER.characterId, guesses: [], solvedAt: null, isBot: true },
      ],
      status: 'playing',
      winnerUid: null,
      startedAt: Date.now(),
      chat: [{ id: uid(), uid: DEMO_STRANGER.uid, name: DEMO_STRANGER.name, text: pick(BOT_LINES.greet), at: Date.now() }],
      opponentUid: DEMO_STRANGER.uid,
      opponentIsFriend,
    };
    this.game = game;
    await this.pushQueue({ status: 'matched', since: Date.now() });
    await this.pushGame();
    // Icebreaker via socialAI (Meta later)
    void socialAI.icebreaker(this.settings.topic, DEMO_STRANGER.topic).then(async (r) => {
      if (this.game?.id !== game.id) return;
      this.game = { ...this.game, icebreaker: r.data, icebreakerProvider: r.provider };
      await this.pushGame();
    });
    this.scheduleBotGuess();
  }

  protected scheduleBotGuess() {
    this.stopBot();
    const delay = this.settings.demoMode ? 7000 + Math.random() * 3000 : 12000 + Math.random() * 6000;
    this.botTimer = setTimeout(() => void this.botTurn(), delay);
  }
  protected stopBot() {
    if (this.botTimer) clearTimeout(this.botTimer);
    this.botTimer = null;
  }
  protected async botTurn() {
    const g = this.game;
    if (!g || g.status !== 'playing') return;
    const bot = g.players.find((p) => p.isBot);
    if (!bot || bot.guesses.length >= 6) return;
    const w = botNextGuess(bot.guesses, g.word);
    const marks = score(w, g.word);
    bot.guesses = [...bot.guesses, { word: w, marks }];
    if (marks.every((m) => m === 'g')) bot.solvedAt = Date.now();
    else if (bot.guesses.length >= 6) bot.failed = true;
    if (Math.random() < 0.4) g.chat = [...g.chat, { id: uid(), uid: bot.uid, name: bot.name, text: pick(BOT_LINES.guess), at: Date.now() }];
    this.game = { ...g, players: g.players.map((p) => (p.isBot ? { ...bot } : p)) };
    this.finishIfDone();
    await this.pushGame();
    if (this.game.status === 'playing') this.scheduleBotGuess();
  }

  protected finishIfDone() {
    const g = this.game;
    if (!g || g.status !== 'playing') return;
    const solved = g.players.filter((p) => p.solvedAt !== null).sort((a, b) => a.solvedAt! - b.solvedAt!);
    const allDone = g.players.every((p) => p.solvedAt !== null || p.failed || p.guesses.length >= 6);
    if (solved.length || allDone) {
      g.status = 'finished';
      g.winnerUid = solved[0]?.uid ?? null;
      const bot = g.players.find((p) => p.isBot);
      if (bot) {
        const botWon = g.winnerUid === bot.uid;
        g.chat = [...g.chat, { id: uid(), uid: bot.uid, name: bot.name, text: pick(botWon ? BOT_LINES.win : BOT_LINES.lose), at: Date.now() }];
      }
      this.stopBot();
    }
  }

  /** Apply a guess for `playerUid` to the in-memory game; returns error message if invalid. */
  protected applyGuess(playerUid: string, word: string): string | null {
    const g = this.game;
    if (!g || g.status !== 'playing') return 'No game in progress.';
    if (!isValidGuess(word)) return 'Five letters, scholar.';
    const p = g.players.find((x) => x.uid === playerUid);
    if (!p) return 'You are not in this game.';
    if (p.solvedAt !== null || p.guesses.length >= 6) return 'You are out of guesses.';
    const marks = score(word, g.word);
    p.guesses = [...p.guesses, { word, marks }];
    if (marks.every((m) => m === 'g')) p.solvedAt = Date.now();
    else if (p.guesses.length >= 6) p.failed = true;
    this.game = { ...g, players: g.players.map((x) => (x.uid === playerUid ? { ...p } : x)) };
    this.finishIfDone();
    return null;
  }

  protected async localGroupReply(room: RoomState) {
    this.room = { ...room, aiBusy: true };
    await this.pushRoom();
    const r = await socialAI.groupReply(
      room.topic,
      room.members.map((m) => m.name),
      room.messages.map((m) => ({ name: m.name, text: m.text, isAI: m.isAI })),
    );
    if (!this.room || this.room.id !== room.id) return;
    this.room = {
      ...this.room,
      aiBusy: false,
      messages: [...this.room.messages, { id: uid(), uid: 'ai', name: 'Study Spirit', text: r.data, isAI: true, provider: r.provider, at: Date.now() }],
    };
    await this.pushRoom();
  }
}

// =====================================================================
// LocalBackend — no Firebase configured (or offline). Friends = demo
// friends (when Demo Mode is on), stranger = bot, rooms = me + AI.
// =====================================================================
export class LocalBackend extends SocialBackend {
  protected async onPresenceChanged() {
    /* nothing to publish locally */
  }
  async setName(name: string) {
    await this.pushMe({ name });
    await store.update('settings', { displayName: name });
  }
  async addFriendByCode(code: string) {
    return { ok: false, message: `No one answers to ${code} in local mode. Connect Firebase to add real friends.` };
  }
  async respondRequest() {}
  async removeFriend(uid: string) {
    this.friends = this.friends.filter((f) => f.uid !== uid);
    await this.pushFriends();
  }
  async nudge() {}
  async sendChallenge(uid: string, prompt?: string, answers?: string[], generate?: boolean) {
    const target = DEMO_FRIENDS.find((f) => f.uid === uid);
    const ch = await this.generateChallengeFor(target?.name ?? 'a friend', prompt, answers, generate);
    // In local mode the "friend" immediately sends one back so the lockdown demo works
    await addPendingFriendChallenge({
      challengeId: uid + '-' + Date.now(),
      fromId: uid,
      fromName: target?.name ?? 'A friend',
      prompt: ch.prompt,
      answers: ch.answers,
      at: Date.now(),
    });
    return { prompt: ch.prompt, provider: ch.provider };
  }
  async createRoom() {
    this.room = {
      id: 'local-' + uid(),
      code: genCode(),
      topic: this.settings.topic || 'study',
      hostUid: this.me.uid,
      members: [
        { uid: this.me.uid, name: this.me.name, characterId: this.me.characterId },
        ...(this.settings.demoMode ? DEMO_FRIENDS.slice(0, 2).map((f) => ({ uid: f.uid, name: f.name, characterId: f.characterId })) : []),
      ],
      messages: [],
      flashcards: [],
      quiz: [],
    };
    await this.pushRoom();
  }
  async joinRoom(code: string) {
    return { ok: false, message: `Room ${code} is beyond the veil in local mode. Connect Firebase to join friends' rooms.` };
  }
  async leaveRoom() {
    this.room = null;
    await this.pushRoom();
  }
  async roomMessage(text: string) {
    if (!this.room || !text) return;
    this.room = { ...this.room, messages: [...this.room.messages, { id: uid(), uid: this.me.uid, name: this.me.name, text, at: Date.now() }] };
    await this.pushRoom();
    await this.localGroupReply(this.room);
  }
  async roomFlashcards(notes: string) {
    if (!this.room) return;
    this.room = { ...this.room, aiBusy: true };
    await this.pushRoom();
    const r = await socialAI.generateFlashcards(this.room.topic, notes, 6);
    if (!this.room) return;
    this.room = { ...this.room, aiBusy: false, flashcards: r.data, flashcardsProvider: r.provider };
    await this.pushRoom();
  }
  async roomQuiz() {
    if (!this.room) return;
    this.room = { ...this.room, aiBusy: true };
    await this.pushRoom();
    const r = await socialAI.generateQuiz(this.room.topic, 3, 'medium');
    if (!this.room) return;
    this.room = { ...this.room, aiBusy: false, quiz: r.data, quizProvider: r.provider };
    await this.pushRoom();
  }
  async findStranger() {
    await this.pushQueue({ status: 'waiting', since: Date.now(), message: 'Searching the tavern…' });
    setTimeout(() => {
      if (this.queue.status === 'waiting') void this.startBotGame(false);
    }, this.settings.demoMode ? 2500 : 4000);
  }
  async cancelFind() {
    await this.pushQueue({ status: 'idle', since: 0 });
  }
  async inviteFriendToGame() {
    await this.startBotGame(true);
  }
  async acceptInvite() {}
  async guess(word: string) {
    const err = this.applyGuess(this.me.uid, word);
    if (err) return { ok: false, message: err };
    await this.pushGame();
    return { ok: true };
  }
  async gameChat(text: string) {
    if (!this.game || !text) return;
    this.game = { ...this.game, chat: [...this.game.chat, { id: uid(), uid: this.me.uid, name: this.me.name, text, at: Date.now() }] };
    await this.pushGame();
    setTimeout(async () => {
      if (!this.game) return;
      this.game = { ...this.game, chat: [...this.game.chat, { id: uid(), uid: DEMO_STRANGER.uid, name: DEMO_STRANGER.name, text: pick(BOT_LINES.reply), at: Date.now() }] };
      await this.pushGame();
    }, 1500 + Math.random() * 1500);
  }
  async leaveGame() {
    this.stopBot();
    this.game = null;
    await this.pushGame();
    await this.pushQueue({ status: 'idle', since: 0 });
  }
  async addFriendFromGame() {
    if (!this.game) return { ok: false, message: 'No game.' };
    const f: Friend = { uid: DEMO_STRANGER.uid, name: DEMO_STRANGER.name, characterId: DEMO_STRANGER.characterId, status: 'break', focusMsToday: 38 * 60000, topic: DEMO_STRANGER.topic, lastSeen: Date.now() };
    if (!this.friends.some((x) => x.uid === f.uid)) this.friends = [...this.friends, f];
    await this.pushFriends();
    return { ok: true, message: `${f.name} is now your friend.` };
  }
}
