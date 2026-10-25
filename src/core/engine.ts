// Focus engine (background only): turns tab/idle/screen signals into mood
// changes, schedules Gemini screen checks, triggers roasts and lockdown.
import { browser } from 'wxt/browser';
import * as visionAI from '@/ai/visionAI';
import { SENSITIVE_SITES } from './defaults';
import { beginLockdown } from './lockdown';
import { characterLine, levelFor, makeLine, moodLine, stepScore } from './mood';
import { isFocusing } from './session';
import * as store from './storage';
import type { FocusSignal, MoodState, Settings } from './types';
import { hostnameOf, isRestrictedUrl, matchesSiteList } from './util';

// In-memory scratch (fine to lose on SW sleep; storage is authoritative)
let lastEvalAt = 0;
let lastScreenCheckAt = 0;
let lastRoastAt = 0;
let lastEncourageAt = 0;
let screenCheckInFlight = false;
let pendingClassify = new Set<string>();
type IdleState = 'active' | 'idle' | 'locked';
let idleState: IdleState = 'active';
/** Most recent screen verdict (url → signal) so the next evaluate() can use it */
let lastScreenSignal: FocusSignal | null = null;

export function setIdleState(s: IdleState) {
  idleState = s;
}

export interface ActiveTabInfo {
  url: string;
  title: string;
  tabId?: number;
  windowId?: number;
}

export async function getActiveTab(): Promise<ActiveTabInfo | null> {
  try {
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab) return null;
    return { url: tab.url ?? '', title: tab.title ?? '', tabId: tab.id, windowId: tab.windowId };
  } catch {
    return null;
  }
}

function listSignal(url: string, settings: Settings): FocusSignal | null {
  const now = Date.now();
  if (matchesSiteList(url, settings.blockSites))
    return { at: now, url, title: '', onTask: false, source: 'blocklist' };
  if (matchesSiteList(url, settings.allowSites))
    return { at: now, url, title: '', onTask: true, source: 'allowlist' };
  return null;
}

async function cachedClassification(url: string, settings: Settings): Promise<boolean | null> {
  const host = hostnameOf(url);
  if (!host) return null;
  const cache = await store.get('domainCache');
  const e = cache[host];
  if (e && e.topic === settings.topic && Date.now() - e.at < 6 * 3600_000) return e.onTask;
  return null;
}

async function classifyInBackground(tab: ActiveTabInfo, settings: Settings) {
  const host = hostnameOf(tab.url);
  if (!host || pendingClassify.has(host)) return;
  pendingClassify.add(host);
  try {
    const r = await visionAI.classifySite(tab.url, tab.title, {
      characterId: settings.characterId,
      petName: settings.petName,
      topic: settings.topic,
    });
    if (r.data) {
      await store.update('domainCache', (c) => ({
        ...c,
        [host]: { onTask: r.data!.on_task, at: Date.now(), topic: settings.topic },
      }));
    }
  } finally {
    pendingClassify.delete(host);
  }
}

/** Decide the current on-task signal for the active tab. */
async function currentSignal(tab: ActiveTabInfo, settings: Settings): Promise<FocusSignal> {
  const now = Date.now();
  const base: FocusSignal = { at: now, url: tab.url, title: tab.title, onTask: null, source: 'none' };
  if (idleState !== 'active') return { ...base, source: 'idle' };
  if (isRestrictedUrl(tab.url)) return base;

  // Fresh screen verdict for this exact URL wins.
  const freshMs = settings.demoMode ? 15_000 : 120_000;
  if (lastScreenSignal && lastScreenSignal.url === tab.url && now - lastScreenSignal.at < freshMs) {
    return lastScreenSignal;
  }
  const fromList = listSignal(tab.url, settings);
  if (fromList) return { ...fromList, title: tab.title };

  const cached = await cachedClassification(tab.url, settings);
  if (cached !== null) return { ...base, onTask: cached, source: 'classifier' };
  void classifyInBackground(tab, settings);
  return base; // unknown for now
}

function screenCheckAllowed(tab: ActiveTabInfo, settings: Settings): boolean {
  if (!settings.screenCheckEnabled) return false;
  if (isRestrictedUrl(tab.url)) return false;
  if (!/^https?:/.test(tab.url)) return false;
  if (matchesSiteList(tab.url, SENSITIVE_SITES)) return false;
  // Don't spend quota on sites the user explicitly allowed
  if (matchesSiteList(tab.url, settings.allowSites)) return false;
  return true;
}

async function captureDownscaled(windowId?: number): Promise<visionAI.Screenshot | null> {
  try {
    const dataUrl = await browser.tabs.captureVisibleTab(windowId as number, {
      format: 'jpeg',
      quality: 70,
    });
    const blob = await (await fetch(dataUrl)).blob();
    const bmp = await createImageBitmap(blob);
    const targetW = 800;
    const scale = Math.min(1, targetW / bmp.width);
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const out = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.6 });
    const buf = new Uint8Array(await out.arrayBuffer());
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)));
    }
    return { mimeType: 'image/jpeg', dataBase64: btoa(bin) };
  } catch (err) {
    // Incognito windows / restricted pages throw; that's expected.
    console.debug('[engine] capture failed', err instanceof Error ? err.message : err);
    return null;
  }
}

/** Take a screenshot, ask Gemini, store the verdict, maybe roast. */
export async function runScreenCheck(force = false): Promise<string> {
  const { settings, session, lockdown } = await store.getMany(['settings', 'session', 'lockdown']);
  if (!force && (!isFocusing(session) || lockdown.active)) return 'skipped: not in focus';
  const tab = await getActiveTab();
  if (!tab) return 'skipped: no active tab';
  if (!force && !screenCheckAllowed(tab, settings)) return 'skipped: not allowed on this site';
  if (screenCheckInFlight) return 'skipped: in flight';
  screenCheckInFlight = true;
  lastScreenCheckAt = Date.now();
  await store.update('mood', { looking: true });
  try {
    const shot = await captureDownscaled(tab.windowId);
    if (!shot) return 'capture failed';
    const r = await visionAI.checkScreen(shot, {
      characterId: settings.characterId,
      petName: settings.petName,
      topic: settings.topic,
    });
    if (!r.data) return `no verdict (${r.provider})`;
    lastScreenSignal = {
      at: Date.now(),
      url: tab.url,
      title: tab.title,
      onTask: r.data.on_task,
      source: 'screen',
      activity: r.data.activity,
      roastHook: r.data.roast_hook,
      confidence: r.data.confidence,
    };
    // Evaluate immediately so the UI reacts; also roast if off task.
    await evaluate(tab);
    if (!r.data.on_task) void maybeRoast(settings, r.data.activity, r.data.roast_hook);
    return `${r.data.on_task ? 'on task' : 'OFF task'} (${Math.round(r.data.confidence * 100)}%): ${r.data.activity}`;
  } finally {
    screenCheckInFlight = false;
    await store.update('mood', { looking: false });
  }
}

async function maybeRoast(settings: Settings, activity: string, hook: string) {
  const minGap = settings.demoMode ? 12_000 : 90_000;
  if (Date.now() - lastRoastAt < minGap) return;
  lastRoastAt = Date.now();
  const r = await visionAI.roast(activity, hook, {
    characterId: settings.characterId,
    petName: settings.petName,
    topic: settings.topic,
  });
  const cur = await store.get('mood');
  if (cur.level === 0 || cur.level === 4) return; // got back on task or already locked
  await store.update('mood', { lastLine: makeLine(r.data, 'roast', r.provider) });
}

/**
 * Main tick. Called on heartbeats, tab events, idle changes and alarms.
 * Integrates the current signal over elapsed time and updates mood/lockdown.
 */
export async function evaluate(tabOverride?: ActiveTabInfo | null): Promise<MoodState> {
  const { settings, session, mood, lockdown } = await store.getMany([
    'settings',
    'session',
    'mood',
    'lockdown',
  ]);
  const now = Date.now();
  const maxDt = settings.demoMode ? 10 : 60;
  const dt = lastEvalAt ? Math.min(maxDt, (now - lastEvalAt) / 1000) : 0;
  lastEvalAt = now;

  if (settings.disabled || lockdown.active) return mood;

  const focusing = isFocusing(session);
  let next: MoodState = { ...mood, updatedAt: now };

  if (!focusing) {
    // Not in a focus block: drift back to happy, no judgement.
    next.score = stepScore(mood.score, true, dt, settings);
    next.level = levelFor(next.score);
    await store.set('mood', next);
    return next;
  }

  const tab = tabOverride ?? (await getActiveTab());
  if (!tab) return mood;
  const signal = await currentSignal(tab, settings);
  next.lastSignal = signal;
  next.score = stepScore(mood.score, signal.onTask, dt, settings);
  next.level = levelFor(next.score);

  // Level went up → in-character line for the new level
  if (next.level > mood.level && next.level < 4) {
    next.lastLine = makeLine(moodLine(settings.characterId, next.level), 'mood');
  }
  // Calmed down all the way → a little praise
  if (next.level === 0 && mood.level > 0) {
    next.lastLine = makeLine(characterLine(settings.characterId, 'encourage'), 'encourage');
  }
  // Occasional encouragement/joke while focused (not spammy)
  const encourageGap = settings.demoMode ? 40_000 : 4 * 60_000;
  if (next.level === 0 && now - lastEncourageAt > encourageGap && Math.random() < 0.35) {
    lastEncourageAt = now;
    next.lastLine = makeLine(
      characterLine(settings.characterId, Math.random() < 0.5 ? 'joke' : 'encourage'),
      'joke',
    );
  }

  await store.set('mood', next);

  if (next.level === 4) {
    await beginLockdown(signal.activity ?? describe(signal));
    return next;
  }

  // Schedule a screen check when it's useful: unknown site, or blocklisted
  // (so the roast can reference what's actually on screen).
  const interval = settings.demoMode ? 5_000 : 60_000;
  const wantsCheck =
    screenCheckAllowed(tab, settings) &&
    (signal.source === 'none' || signal.source === 'blocklist' || signal.source === 'classifier' || signal.source === 'screen') &&
    now - lastScreenCheckAt >= interval;
  if (wantsCheck) void runScreenCheck();

  return next;
}

function describe(s: FocusSignal): string {
  const host = hostnameOf(s.url);
  return host ? `browsing ${host}` : 'wandering off';
}

/** Called when the user hides/disables the widget — returns a guilt-trip line. */
export async function guiltLine(how: 'hide' | 'disable'): Promise<string> {
  const { settings, session } = await store.getMany(['settings', 'session']);
  if (!isFocusing(session)) return '';
  const line = characterLine(settings.characterId, how === 'hide' ? 'guiltHide' : 'guiltDisable');
  await store.update('mood', { lastLine: makeLine(line, 'guilt') });
  return line;
}

/** Phase-change lines (break/back to work). */
export async function announcePhase(status: 'focus' | 'break' | 'longBreak') {
  const settings = await store.get('settings');
  const line = characterLine(settings.characterId, status === 'focus' ? 'backToWork' : 'breakTime');
  await store.update('mood', (m) => ({
    ...m,
    score: status === 'focus' ? m.score : 0,
    level: status === 'focus' ? m.level : 0,
    lastLine: makeLine(line, 'system'),
  }));
}

export function resetScratch() {
  lastEvalAt = 0;
  lastScreenCheckAt = 0;
  lastRoastAt = 0;
  lastScreenSignal = null;
}
