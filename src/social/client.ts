// UI-side helpers for the social layer.
import { browser } from 'wxt/browser';
import { send } from '@/core/messaging';
import type { SocialCmd } from './types';

let ensured = false;
/** Ask the service worker to make sure the offscreen document exists, then send a command. */
export async function social<T = unknown>(cmd: SocialCmd): Promise<T> {
  if (!ensured) {
    await send('social:ensure', {}).catch(() => {});
    ensured = true;
  }
  const res = (await browser.runtime.sendMessage({ type: 'social:cmd', payload: cmd })) as
    | { ok: true; data: T }
    | { ok: false; error: string }
    | undefined;
  if (!res) {
    ensured = false;
    throw new Error('The social spirit is not awake yet — try again in a moment.');
  }
  if (!res.ok) throw new Error(res.error);
  return res.data;
}
