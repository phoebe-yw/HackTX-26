// Offscreen document: hosts the social backend (Firebase or local) for the whole browser.
// Created by the service worker; stays alive; mirrors state into chrome.storage.session.
import { browser } from 'wxt/browser';
import * as store from '@/core/storage';
import { CHARACTERS } from '@/data/characters';
import { LocalBackend, SocialBackend, genCode } from '@/social/backend';
import { FirestoreBackend, firebaseConfigFromEnv } from '@/social/firestore';
import { SK, type Me, type SocialCmd } from '@/social/types';

let backend: SocialBackend | null = null;
let starting: Promise<SocialBackend> | null = null;

async function seedMe(): Promise<Me> {
  const settings = await store.get('settings');
  const res = await browser.storage.local.get(['social.localUid', 'social.localCode']);
  let localUid = res['social.localUid'] as string | undefined;
  let localCode = res['social.localCode'] as string | undefined;
  if (!localUid) {
    localUid = 'local-' + Math.random().toString(36).slice(2, 10);
    localCode = genCode();
    await browser.storage.local.set({ 'social.localUid': localUid, 'social.localCode': localCode });
  }
  const name = settings.displayName || `${settings.petName || CHARACTERS[settings.characterId].defaultPetName}'s scholar`;
  return { uid: localUid, name, code: localCode ?? 'LOCAL0', characterId: settings.characterId, mode: 'local', ready: true };
}

async function start(): Promise<SocialBackend> {
  const me = await seedMe();
  const cfg = firebaseConfigFromEnv();
  if (cfg) {
    try {
      const be = await FirestoreBackend.connect(cfg, me);
      console.info('[offscreen] social backend: firebase', be.me.uid);
      return be;
    } catch (e) {
      console.warn('[offscreen] Firebase failed, falling back to local mode', e);
      const be = new LocalBackend({ ...me, error: e instanceof Error ? e.message : String(e) });
      await be.init();
      return be;
    }
  }
  const be = new LocalBackend(me);
  await be.init();
  console.info('[offscreen] social backend: local (no Firebase config)');
  return be;
}

function ensure(): Promise<SocialBackend> {
  if (backend) return Promise.resolve(backend);
  if (!starting) starting = start().then((b) => (backend = b));
  return starting;
}

browser.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  const m = msg as { type?: string; payload?: SocialCmd } | null;
  if (!m || m.type !== 'social:cmd' || !m.payload) return false;
  ensure()
    .then((b) => b.handle(m.payload!))
    .then((data) => sendResponse({ ok: true, data }))
    .catch((e: unknown) => sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  return true;
});

// Boot immediately so presence is live even before anyone opens a social page.
void ensure().catch((e) => {
  console.error('[offscreen] boot failed', e);
  void store.setSession(SK.me, { uid: '', name: '', code: '', characterId: 'red', mode: 'local', ready: false, error: String(e) } satisfies Me);
});
