import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { PROVIDERS } from '@/ai/config';
import * as socialAI from '@/ai/socialAI';
import * as visionAI from '@/ai/visionAI';
import { DEFAULT_LOCKDOWN, DEFAULT_MOOD, DEFAULT_SESSION } from '@/core/defaults';
import * as engine from '@/core/engine';
import {
  beginLockdown,
  escapeLockdown,
  failLockdown,
  newChallenge,
  solveLockdown,
} from '@/core/lockdown';
import { listen } from '@/core/messaging';
import { levelFor, makeLine } from '@/core/mood';
import * as session from '@/core/session';
import * as store from '@/core/storage';
import type { ChatMessage } from '@/core/types';
import { uid } from '@/core/util';
import { CHARACTERS, pick } from '@/data/characters';

export default defineBackground(() => {
  console.info('[bg] Once Upon a Focus service worker up');

  // Let content scripts read storage.session (social mirror)
  void browser.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });

  browser.runtime.onInstalled.addListener(async ({ reason }) => {
    if (reason === 'install' || reason === 'update') void reinjectOpenTabs();
    await ensureTick();
    const settings = await store.get('settings');
    if (reason === 'install' || !settings.onboarded) {
      await browser.tabs.create({ url: browser.runtime.getURL('/options.html') });
    }
  });
  browser.runtime.onStartup.addListener(() => void ensureTick());
  void ensureTick();

  async function ensureTick() {
    const existing = await browser.alarms.get(session.ALARM_TICK);
    if (!existing) await browser.alarms.create(session.ALARM_TICK, { periodInMinutes: 0.5 });
    await ensureOffscreen();
  }

  /** Chrome detaches content scripts from open tabs on install/reload; put the widget back. */
  async function reinjectOpenTabs() {
    const files = browser.runtime.getManifest().content_scripts?.flatMap((c) => c.js ?? []) ?? [];
    if (!files.length) return;
    const tabs = await browser.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const t of tabs) {
      if (t.id == null || t.discarded) continue;
      chrome.scripting.executeScript({ target: { tabId: t.id }, files }).catch(() => {});
    }
  }

  // The offscreen document can't subscribe to storage itself
  browser.storage.onChanged.addListener((changes, area) => {
    browser.runtime.sendMessage({ type: 'store:changed', payload: { changes, area } }).catch(() => {});
  });

  let creatingOffscreen: Promise<void> | null = null;
  /** The offscreen document hosts the social backend (Firebase) for the whole browser. */
  async function ensureOffscreen() {
    try {
      const contexts = await (chrome.runtime as unknown as {
        getContexts: (f: { contextTypes: string[] }) => Promise<unknown[]>;
      }).getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
      if (contexts.length > 0) return;
      if (!creatingOffscreen) {
        creatingOffscreen = chrome.offscreen
          .createDocument({
            url: 'offscreen.html',
            reasons: ['LOCAL_STORAGE' as chrome.offscreen.Reason],
            justification: 'Keeps the Firebase realtime connection for presence, rooms and games alive.',
          })
          .catch((e: unknown) => {
            if (!String(e).includes('single offscreen')) console.warn('[bg] offscreen create failed', e);
          })
          .finally(() => {
            creatingOffscreen = null;
          });
      }
      await creatingOffscreen;
    } catch (e) {
      console.warn('[bg] ensureOffscreen', e);
    }
  }

  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === session.ALARM_PHASE_END) {
      const before = await store.get('session');
      const after = await session.advancePhase(before.phaseEndsAt);
      if (after.status !== 'idle' && after.strikeSeq !== before.strikeSeq)
        await engine.announcePhase(after.status);
    } else if (alarm.name === session.ALARM_TICK) {
      await session.checkExpired();
      await engine.evaluate();
      await ensureOffscreen();
    }
  });

  browser.tabs.onActivated.addListener(() => void engine.evaluate());
  browser.tabs.onUpdated.addListener((_id, info, tab) => {
    if ((info.status === 'complete' || info.title) && tab.active) void engine.evaluate();
  });
  browser.windows.onFocusChanged.addListener(() => void engine.evaluate());
  browser.idle.setDetectionInterval(60);
  browser.idle.onStateChanged.addListener((state) => {
    engine.setIdleState(state);
    void engine.evaluate();
  });

  async function petCtx() {
    const s = await store.get('settings');
    return { characterId: s.characterId, petName: s.petName, topic: s.topic };
  }

  listen({
    // ---- session
    'session:start': async () => {
      await session.startSession();
      engine.resetScratch();
      await store.update('mood', { ...DEFAULT_MOOD, updatedAt: Date.now() });
      const s = await store.get('settings');
      await store.update('mood', {
        lastLine: makeLine(pick(CHARACTERS[s.characterId].lines[0]), 'encourage'),
      });
      return { ok: true };
    },
    'session:stop': async () => {
      await session.stopSession();
      await store.update('mood', { score: 0, level: 0 });
      return { ok: true };
    },
    'session:pause': async () => {
      await session.pauseSession();
      return { ok: true };
    },
    'session:resume': async () => {
      await session.resumeSession();
      return { ok: true };
    },
    'session:skip': async () => {
      const before = await store.get('session');
      const after = await session.advancePhase();
      if (after.status !== 'idle' && after.strikeSeq !== before.strikeSeq)
        await engine.announcePhase(after.status);
      return { ok: true };
    },
    'session:expired': async ({ phaseEndsAt }) => {
      const before = await store.get('session');
      const after = await session.advancePhase(phaseEndsAt);
      if (after.status !== 'idle' && after.strikeSeq !== before.strikeSeq)
        await engine.announcePhase(after.status);
      return { ok: true };
    },

    // ---- focus signals
    'focus:heartbeat': async ({ url, title }, sender) => {
      await session.checkExpired();
      // Only trust heartbeats from the active tab
      const active = await engine.getActiveTab();
      if (active && sender.tabId !== undefined && active.tabId === sender.tabId) {
        await engine.evaluate({ ...active, url: url || active.url, title: title || active.title });
      }
      return { ok: true };
    },
    'widget:hidden': async ({ how }) => ({ line: await engine.guiltLine(how) }),

    // ---- lockdown
    'lockdown:solved': async () => {
      await solveLockdown();
      return { ok: true };
    },
    'lockdown:failed': async () => {
      await failLockdown();
      return { ok: true };
    },
    'lockdown:newChallenge': async () => {
      await newChallenge();
      return { ok: true };
    },
    'lockdown:escape': async ({ url }) => ({ line: await escapeLockdown(url) }),
    'lockdown:force': async ({ type }) => {
      await beginLockdown('a dev-panel button', type);
      return { ok: true };
    },

    // ---- ai
    'ai:ask': async ({ text, withScreen }) => {
      const ctx = await petCtx();
      const history = await store.get('chatHistory');
      const userMsg: ChatMessage = { id: uid(), role: 'user', text, at: Date.now(), withScreen };
      await store.set('chatHistory', [...history, userMsg].slice(-40));
      let shot: visionAI.Screenshot | null = null;
      if (withScreen) {
        const tab = await engine.getActiveTab();
        shot = tab ? await captureForAsk(tab.windowId) : null;
      }
      const r = await visionAI.askAboutScreen(
        text,
        shot,
        history
          .filter((m) => m.role !== 'system')
          .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }) as const),
        ctx,
      );
      const petMsg: ChatMessage = {
        id: uid(),
        role: 'pet',
        text: r.data,
        at: Date.now(),
        provider: r.provider,
        withScreen: Boolean(shot),
      };
      await store.update('chatHistory', (h) => [...h, petMsg].slice(-40));
      return { message: petMsg };
    },
    'ai:clearChat': async () => {
      await store.set('chatHistory', []);
      return { ok: true };
    },
    'ai:quote': async () => {
      const ctx = await petCtx();
      const r = await socialAI.quote(ctx.characterId, ctx.petName, ctx.topic);
      return { text: r.data, provider: r.provider };
    },
    'ai:ping': async ({ provider }) => {
      const p = PROVIDERS[provider];
      const t0 = Date.now();
      try {
        if (!p.isConfigured()) return { ok: false, text: 'not configured (missing key in .env)', ms: 0 };
        const text = await p.chat(
          [{ role: 'user', content: 'Reply with one short fairytale-flavored greeting (max 12 words).' }],
          { timeoutMs: 15_000, maxTokens: 60 },
        );
        return { ok: true, text, ms: Date.now() - t0 };
      } catch (e) {
        return { ok: false, text: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 };
      }
    },
    'ai:testSocial': async ({ provider }) => {
      if (provider) await store.update('aiOverrides', { social: provider });
      const results = await socialAI.selfTest();
      return { results };
    },
    'ai:screenCheckNow': async () => {
      const summary = await engine.runScreenCheck(true);
      return { ok: !summary.startsWith('skipped') && !summary.includes('failed'), summary };
    },

    // ---- social plumbing
    'social:ensure': async () => {
      await ensureOffscreen();
      return { ok: true };
    },
    'store:get': async ({ area, keys }) => browser.storage[area].get(keys),
    'store:set': async ({ area, items }) => {
      await browser.storage[area].set(items);
      return { ok: true };
    },

    // ---- demo / dev
    'demo:set': async ({ enabled }) => {
      await store.update('settings', { demoMode: enabled });
      engine.resetScratch();
      return { ok: true };
    },
    'demo:setMood': async ({ score }) => {
      await store.update('mood', { score, level: levelFor(score) });
      if (score >= 100) await beginLockdown('a dev-panel slider');
      return { ok: true };
    },
    'dev:resetAll': async () => {
      await browser.alarms.clearAll();
      await browser.storage.local.clear();
      await browser.storage.session.clear();
      await store.set('session', DEFAULT_SESSION);
      await store.set('mood', DEFAULT_MOOD);
      await store.set('lockdown', DEFAULT_LOCKDOWN);
      await ensureTick();
      return { ok: true };
    },
    'dev:openOptions': async ({ hash }) => {
      await browser.tabs.create({ url: browser.runtime.getURL('/options.html') + (hash ?? '') });
      return { ok: true };
    },
  });

  async function captureForAsk(windowId?: number): Promise<visionAI.Screenshot | null> {
    try {
      const dataUrl = await browser.tabs.captureVisibleTab(windowId as number, { format: 'jpeg', quality: 80 });
      const blob = await (await fetch(dataUrl)).blob();
      const bmp = await createImageBitmap(blob);
      const scale = Math.min(1, 1280 / bmp.width);
      const canvas = new OffscreenCanvas(Math.round(bmp.width * scale), Math.round(bmp.height * scale));
      canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      bmp.close();
      const out = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.75 });
      const buf = new Uint8Array(await out.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000)
        bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + 0x8000)));
      return { mimeType: 'image/jpeg', dataBase64: btoa(bin) };
    } catch (e) {
      console.debug('[bg] ask capture failed', e);
      return null;
    }
  }
});
