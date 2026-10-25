// Session (focus/break) state machine. Runs in the background service worker.
// Durable state in chrome.storage; transitions scheduled with chrome.alarms.
import { browser } from 'wxt/browser';
import * as store from './storage';
import type { SessionState, SessionStatus, Settings } from './types';
import { todayKey } from './util';

export const ALARM_PHASE_END = 'phase-end';
export const ALARM_TICK = 'tick';

function unitMs(settings: Settings): number {
  // Demo Mode: minutes become seconds (25 min → 25 s)
  return settings.demoMode ? 1000 : 60_000;
}

export function phaseDurationMs(status: SessionStatus, settings: Settings): number {
  const m = settings.method;
  if (m.id === 'none') return 0; // open-ended focus, no breaks
  const u = unitMs(settings);
  switch (status) {
    case 'focus':
      return m.focusMin * u;
    case 'break':
      return m.breakMin * u;
    case 'longBreak':
      return m.longBreakMin * u;
    default:
      return 0;
  }
}

async function schedulePhaseEnd(endsAt: number) {
  await browser.alarms.clear(ALARM_PHASE_END);
  if (endsAt > 0) await browser.alarms.create(ALARM_PHASE_END, { when: endsAt });
}

async function rollDay(s: SessionState): Promise<SessionState> {
  const key = todayKey();
  if (s.dateKey !== key) return { ...s, dateKey: key, focusMsToday: 0 };
  return s;
}

/** Credit elapsed focus time into today's total (called on any focus→X transition). */
function creditFocus(s: SessionState, now: number): SessionState {
  if (s.status !== 'focus' || s.paused) return s;
  const elapsed = Math.max(0, now - s.phaseStartedAt);
  return { ...s, focusMsToday: s.focusMsToday + elapsed };
}

export async function startSession(): Promise<SessionState> {
  const settings = await store.get('settings');
  const now = Date.now();
  let s = await rollDay(await store.get('session'));
  const dur = phaseDurationMs('focus', settings);
  s = {
    ...s,
    status: 'focus',
    phaseStartedAt: now,
    phaseEndsAt: dur > 0 ? now + dur : 0,
    focusBlocksDone: 0,
    paused: false,
    remainingMs: 0,
    strikeSeq: s.strikeSeq + 1,
  };
  await store.set('session', s);
  await schedulePhaseEnd(s.phaseEndsAt);
  return s;
}

export async function stopSession(): Promise<SessionState> {
  const now = Date.now();
  let s = creditFocus(await store.get('session'), now);
  s = { ...s, status: 'idle', phaseStartedAt: 0, phaseEndsAt: 0, paused: false, remainingMs: 0 };
  await store.set('session', s);
  await schedulePhaseEnd(0);
  return s;
}

export async function pauseSession(): Promise<SessionState> {
  const now = Date.now();
  let s = await store.get('session');
  if (s.status === 'idle' || s.paused) return s;
  s = creditFocus(s, now);
  s = {
    ...s,
    paused: true,
    remainingMs: s.phaseEndsAt > 0 ? Math.max(0, s.phaseEndsAt - now) : 0,
  };
  await store.set('session', s);
  await schedulePhaseEnd(0);
  return s;
}

export async function resumeSession(): Promise<SessionState> {
  const now = Date.now();
  let s = await store.get('session');
  if (s.status === 'idle' || !s.paused) return s;
  s = {
    ...s,
    paused: false,
    phaseStartedAt: now,
    phaseEndsAt: s.remainingMs > 0 ? now + s.remainingMs : 0,
    remainingMs: 0,
  };
  await store.set('session', s);
  await schedulePhaseEnd(s.phaseEndsAt);
  return s;
}

/** Advance to the next phase. Idempotent when `expectedEndsAt` is given. */
export async function advancePhase(expectedEndsAt?: number): Promise<SessionState> {
  const settings = await store.get('settings');
  const now = Date.now();
  let s = await rollDay(await store.get('session'));
  if (s.status === 'idle') return s;
  if (expectedEndsAt !== undefined && s.phaseEndsAt !== expectedEndsAt) return s; // already advanced
  s = creditFocus(s, now);

  let next: SessionStatus;
  let blocks = s.focusBlocksDone;
  if (s.status === 'focus') {
    blocks += 1;
    const m = settings.method;
    next = m.longBreakEvery > 0 && blocks % m.longBreakEvery === 0 ? 'longBreak' : 'break';
  } else {
    next = 'focus';
  }
  const dur = phaseDurationMs(next, settings);
  s = {
    ...s,
    status: next,
    focusBlocksDone: blocks,
    phaseStartedAt: now,
    phaseEndsAt: dur > 0 ? now + dur : 0,
    paused: false,
    remainingMs: 0,
    strikeSeq: s.strikeSeq + 1,
  };
  await store.set('session', s);
  await schedulePhaseEnd(s.phaseEndsAt);
  return s;
}

/** Backstop: if an alarm was missed (SW asleep, demo mode), advance now. */
export async function checkExpired(): Promise<void> {
  const s = await store.get('session');
  if (s.status !== 'idle' && !s.paused && s.phaseEndsAt > 0 && Date.now() >= s.phaseEndsAt) {
    await advancePhase(s.phaseEndsAt);
  }
}

export function isFocusing(s: SessionState): boolean {
  return s.status === 'focus' && !s.paused;
}

export function remainingMs(s: SessionState, now = Date.now()): number {
  if (s.status === 'idle') return 0;
  if (s.paused) return s.remainingMs;
  if (s.phaseEndsAt === 0) return 0;
  return Math.max(0, s.phaseEndsAt - now);
}

