// Typed request/response protocol between contexts (widget/options/popup → background).
import { browser } from 'wxt/browser';
import type { AiProviderId, ChatMessage, Challenge } from './types';

export interface Requests {
  // session
  'session:start': { req: {}; res: { ok: true } };
  'session:stop': { req: {}; res: { ok: true } };
  'session:pause': { req: {}; res: { ok: true } };
  'session:resume': { req: {}; res: { ok: true } };
  'session:skip': { req: {}; res: { ok: true } };
  /** Widget noticed the phase expired before the alarm fired (demo mode). Idempotent. */
  'session:expired': { req: { phaseEndsAt: number }; res: { ok: true } };

  // focus signals
  /** Heartbeat from the visible widget: wakes the SW and drives the mood tick. */
  'focus:heartbeat': {
    req: { url: string; title: string; visible: boolean };
    res: { ok: true };
  };
  'widget:hidden': { req: { how: 'hide' | 'disable' }; res: { line: string } };

  // lockdown
  'lockdown:solved': { req: {}; res: { ok: true } };
  'lockdown:failed': { req: {}; res: { ok: true } };
  'lockdown:newChallenge': { req: {}; res: { ok: true } };
  'lockdown:escape': { req: { url: string }; res: { line: string } };
  /** Dev: force a lockdown now */
  'lockdown:force': { req: { type?: Challenge['type'] }; res: { ok: true } };

  // ai
  'ai:ask': {
    req: { text: string; withScreen: boolean };
    res: { message: ChatMessage };
  };
  'ai:clearChat': { req: {}; res: { ok: true } };
  'ai:quote': { req: {}; res: { text: string; provider: string } };
  'ai:ping': { req: { provider: AiProviderId }; res: { ok: boolean; text: string; ms: number } };
  'ai:testSocial': {
    req: { provider?: AiProviderId };
    res: { results: { fn: string; ok: boolean; provider: string; ms: number; error?: string }[] };
  };
  'ai:screenCheckNow': { req: {}; res: { ok: boolean; summary: string } };

  // social plumbing (commands themselves go to the offscreen doc as 'social:cmd')
  'social:ensure': { req: {}; res: { ok: true } };
  /** Storage bridge for the offscreen document, which has no chrome.storage */
  'store:get': { req: { area: 'local' | 'session'; keys: string | string[] }; res: Record<string, unknown> };
  'store:set': { req: { area: 'local' | 'session'; items: Record<string, unknown> }; res: { ok: true } };

  // demo / dev
  'demo:set': { req: { enabled: boolean }; res: { ok: true } };
  'demo:setMood': { req: { score: number }; res: { ok: true } };
  'dev:resetAll': { req: {}; res: { ok: true } };
  'dev:openOptions': { req: { hash?: string }; res: { ok: true } };
}

export type RequestType = keyof Requests;

export async function send<T extends RequestType>(
  type: T,
  payload: Requests[T]['req'],
): Promise<Requests[T]['res']> {
  const res = (await browser.runtime.sendMessage({ type, payload })) as
    | { ok: true; data: Requests[T]['res'] }
    | { ok: false; error: string };
  if (!res) throw new Error(`No response for ${type}`);
  if ('ok' in res && res.ok === false) throw new Error(res.error);
  return (res as { data: Requests[T]['res'] }).data;
}

export type Handlers = {
  [T in RequestType]: (
    payload: Requests[T]['req'],
    sender: { tabId?: number; url?: string },
  ) => Promise<Requests[T]['res']>;
};

/** Register all handlers in the background. */
export function listen(handlers: Handlers) {
  browser.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
    const m = msg as { type?: RequestType; payload?: unknown } | null;
    if (!m || typeof m.type !== 'string' || !(m.type in handlers)) return false;
    const handler = handlers[m.type] as (
      p: unknown,
      s: { tabId?: number; url?: string },
    ) => Promise<unknown>;
    handler(m.payload ?? {}, { tabId: sender.tab?.id, url: sender.tab?.url ?? sender.url })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err: unknown) => {
        console.warn(`[msg] ${m.type} failed`, err);
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
      });
    return true; // async
  });
}
