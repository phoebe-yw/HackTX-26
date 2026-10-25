// Typed wrapper over chrome.storage. All durable state lives here because MV3
// service workers sleep and lose memory.
import { browser } from 'wxt/browser';
import {
  DEFAULT_LOCKDOWN,
  DEFAULT_MOOD,
  DEFAULT_SESSION,
  DEFAULT_SETTINGS,
} from './defaults';
import type {
  AiOverrides,
  ChatMessage,
  DomainCacheEntry,
  EscapeLogEntry,
  LockdownState,
  MoodState,
  SessionState,
  Settings,
} from './types';

export interface LocalSchema {
  settings: Settings;
  session: SessionState;
  mood: MoodState;
  lockdown: LockdownState;
  domainCache: Record<string, DomainCacheEntry>;
  escapeLog: EscapeLogEntry[];
  aiOverrides: AiOverrides;
  chatHistory: ChatMessage[];
  /** Provider that last answered per module, for badges + dev panel */
  aiLastProvider: Record<string, string>;
}

const DEFAULTS: LocalSchema = {
  settings: DEFAULT_SETTINGS,
  session: DEFAULT_SESSION,
  mood: DEFAULT_MOOD,
  lockdown: DEFAULT_LOCKDOWN,
  domainCache: {},
  escapeLog: [],
  aiOverrides: { social: null, vision: null },
  chatHistory: [],
  aiLastProvider: {},
};

export type LocalKey = keyof LocalSchema;

export async function get<K extends LocalKey>(key: K): Promise<LocalSchema[K]> {
  const res = await browser.storage.local.get(key);
  const val = res[key] as LocalSchema[K] | undefined;
  if (val === undefined) return DEFAULTS[key];
  // Merge objects with defaults so new fields added later don't come back undefined.
  if (isPlainObject(DEFAULTS[key]) && isPlainObject(val)) {
    return { ...(DEFAULTS[key] as object), ...(val as object) } as LocalSchema[K];
  }
  return val;
}

export async function getMany<K extends LocalKey>(keys: K[]): Promise<Pick<LocalSchema, K>> {
  const res = await browser.storage.local.get(keys);
  const out = {} as Pick<LocalSchema, K>;
  for (const k of keys) {
    const val = res[k] as LocalSchema[K] | undefined;
    if (val === undefined) out[k] = DEFAULTS[k];
    else if (isPlainObject(DEFAULTS[k]) && isPlainObject(val))
      out[k] = { ...(DEFAULTS[k] as object), ...(val as object) } as LocalSchema[K];
    else out[k] = val;
  }
  return out;
}

export async function set<K extends LocalKey>(key: K, value: LocalSchema[K]): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

export async function update<K extends LocalKey>(
  key: K,
  patch: Partial<LocalSchema[K]> | ((prev: LocalSchema[K]) => LocalSchema[K]),
): Promise<LocalSchema[K]> {
  const prev = await get(key);
  const next =
    typeof patch === 'function'
      ? (patch as (p: LocalSchema[K]) => LocalSchema[K])(prev)
      : ({ ...(prev as object), ...(patch as object) } as LocalSchema[K]);
  await set(key, next);
  return next;
}

/** Subscribe to changes of one key. Returns an unsubscribe fn. */
export function watch<K extends LocalKey>(
  key: K,
  cb: (value: LocalSchema[K]) => void,
): () => void {
  const listener = (
    changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
    area: string,
  ) => {
    if (area !== 'local' || !(key in changes)) return;
    const nv = changes[key].newValue as LocalSchema[K] | undefined;
    if (nv === undefined) cb(DEFAULTS[key]);
    else if (isPlainObject(DEFAULTS[key]) && isPlainObject(nv))
      cb({ ...(DEFAULTS[key] as object), ...(nv as object) } as LocalSchema[K]);
    else cb(nv);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ---- session-area storage (cleared when the browser closes). Used as the
// mirror for live social data coming from the offscreen Firebase document.
export async function getSession<T>(key: string, fallback: T): Promise<T> {
  try {
    const res = await browser.storage.session.get(key);
    return (res[key] as T | undefined) ?? fallback;
  } catch {
    // Content scripts can't read storage.session until the SW has set the access level
    return fallback;
  }
}
export async function setSession(key: string, value: unknown): Promise<void> {
  await browser.storage.session.set({ [key]: value });
}
export function watchSession<T>(key: string, cb: (v: T | undefined) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area !== 'session' || !(key in changes)) return;
    cb(changes[key].newValue as T | undefined);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
