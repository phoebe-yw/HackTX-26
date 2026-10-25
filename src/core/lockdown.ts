// Lockdown lifecycle + challenge selection. Background only.
import * as socialAI from '@/ai/socialAI';
import { OATHS } from '@/data/curated';
import { pick } from '@/data/characters';
import { characterLine, makeLine } from './mood';
import * as store from './storage';
import type { Challenge, ChallengeType, FriendChallenge, Settings } from './types';

/** Friend challenges waiting to be served (filled by social layer / demo seed). */
export interface PendingFriendChallenge {
  challengeId: string;
  fromId: string;
  fromName: string;
  prompt: string;
  answers: string[];
  at: number;
}

const PENDING_KEY = 'pendingFriendChallenges';

export async function getPendingFriendChallenges(): Promise<PendingFriendChallenge[]> {
  const res = await chrome.storage.local.get(PENDING_KEY);
  return (res[PENDING_KEY] as PendingFriendChallenge[] | undefined) ?? [];
}
export async function setPendingFriendChallenges(list: PendingFriendChallenge[]) {
  await chrome.storage.local.set({ [PENDING_KEY]: list });
}
export async function addPendingFriendChallenge(c: PendingFriendChallenge) {
  const list = await getPendingFriendChallenges();
  if (list.some((x) => x.challengeId === c.challengeId)) return;
  await setPendingFriendChallenges([...list, c]);
}

function weightedType(strictness: Settings['strictness'], exclude?: ChallengeType): ChallengeType {
  const weights: Record<Settings['strictness'], Record<Exclude<ChallengeType, 'friend'>, number>> = {
    gentle: { riddle: 40, quiz: 30, oath: 30 },
    firm: { riddle: 30, quiz: 40, oath: 30 },
    wolf: { riddle: 25, quiz: 45, oath: 30 },
  };
  const entries = (Object.entries(weights[strictness]) as [ChallengeType, number][]).filter(
    ([t]) => t !== exclude,
  );
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [t, w] of entries) {
    r -= w;
    if (r <= 0) return t;
  }
  return entries[0][0];
}

async function buildChallenge(
  settings: Settings,
  forceType?: ChallengeType,
  exclude?: ChallengeType,
): Promise<{ challenge: Challenge; provider: string }> {
  // Friend challenges take priority (unless explicitly excluded / forced otherwise)
  if (!forceType || forceType === 'friend') {
    const pending = await getPendingFriendChallenges();
    if (pending.length && exclude !== 'friend') {
      const [c, ...rest] = pending;
      await setPendingFriendChallenges(rest);
      const fc: FriendChallenge = {
        type: 'friend',
        fromName: c.fromName,
        fromId: c.fromId,
        challengeId: c.challengeId,
        prompt: c.prompt,
        answers: c.answers,
      };
      return { challenge: fc, provider: 'friend' };
    }
    if (forceType === 'friend') forceType = undefined;
  }

  const type = forceType ?? weightedType(settings.strictness, exclude);
  switch (type) {
    case 'quiz': {
      const n = settings.strictness === 'wolf' ? 3 : settings.strictness === 'firm' ? 2 : 1;
      const diff = settings.strictness === 'wolf' ? 'hard' : settings.strictness === 'firm' ? 'medium' : 'easy';
      const r = await socialAI.generateQuiz(settings.topic, n, diff);
      return { challenge: { type: 'quiz', questions: r.data }, provider: r.provider };
    }
    case 'oath': {
      const text = pick(OATHS);
      return {
        challenge: { type: 'oath', text, backwards: settings.strictness === 'wolf' },
        provider: 'curated',
      };
    }
    case 'riddle':
    default: {
      const r = await socialAI.riddle();
      return { challenge: r.data, provider: r.provider };
    }
  }
}

export async function beginLockdown(triggerActivity?: string, forceType?: ChallengeType) {
  const { settings, lockdown } = await store.getMany(['settings', 'lockdown']);
  if (lockdown.active) return;
  const now = Date.now();
  await store.set('lockdown', {
    active: true,
    startedAt: now,
    challenge: null,
    failures: 0,
    triggerActivity,
  });
  await store.update('mood', (m) => ({
    ...m,
    level: 4,
    score: 100,
    lastLine: makeLine(characterLine(settings.characterId, 'lockdownEntrance'), 'mood'),
    updatedAt: now,
  }));
  // Build the challenge asynchronously so the overlay storms in immediately.
  try {
    const { challenge, provider } = await buildChallenge(settings, forceType);
    const cur = await store.get('lockdown');
    if (!cur.active) return;
    await store.update('lockdown', { challenge, challengeProvider: provider });
  } catch (err) {
    console.warn('[lockdown] challenge build failed, using oath', err);
    await store.update('lockdown', {
      challenge: { type: 'oath', text: pick(OATHS), backwards: false },
      challengeProvider: 'curated',
    });
  }
}

export async function newChallenge() {
  const { settings, lockdown } = await store.getMany(['settings', 'lockdown']);
  if (!lockdown.active) return;
  await store.update('lockdown', { challenge: null });
  const { challenge, provider } = await buildChallenge(settings, undefined, lockdown.challenge?.type);
  await store.update('lockdown', { challenge, challengeProvider: provider });
}

export async function solveLockdown() {
  const settings = await store.get('settings');
  const now = Date.now();
  await store.update('lockdown', { active: false, challenge: null, failures: 0 });
  await store.update('mood', (m) => ({
    ...m,
    level: 1,
    score: 30,
    lastUnlockAt: now,
    lastLine: makeLine(characterLine(settings.characterId, 'unlocked'), 'system'),
    updatedAt: now,
  }));
}

export async function failLockdown() {
  const settings = await store.get('settings');
  await store.update('lockdown', (l) => ({ ...l, failures: l.failures + 1 }));
  await store.update('mood', (m) => ({
    ...m,
    lastLine: makeLine(characterLine(settings.characterId, 'wrongAnswer'), 'mood'),
  }));
}

export async function escapeLockdown(url: string): Promise<string> {
  const settings = await store.get('settings');
  const now = Date.now();
  await store.update('escapeLog', (log) => [...log, { at: now, reason: 'held Esc 5s', url }].slice(-50));
  await store.update('lockdown', { active: false, challenge: null, failures: 0 });
  const line = characterLine(settings.characterId, 'sulk');
  await store.update('mood', (m) => ({
    ...m,
    level: 2,
    score: 55,
    lastLine: makeLine(line, 'sulk'),
    updatedAt: now,
  }));
  return line;
}
