// Chooses which provider backs each AI module. Env sets the default; the hidden
// Dev panel can override live (stored in chrome.storage `aiOverrides`).
import type { AiProviderId } from '@/core/types';
import * as store from '@/core/storage';
import { geminiProvider } from './providers/gemini';
import { offlineProvider } from './providers/offline';
import type { TextProvider } from './types';

export const PROVIDERS: Record<AiProviderId, TextProvider> = {
  gemini: geminiProvider,
  offline: offlineProvider,
};

function asProvider(v: unknown): AiProviderId | null {
  return typeof v === 'string' && v in PROVIDERS ? (v as AiProviderId) : null;
}

const ENV_SOCIAL = asProvider(import.meta.env.WXT_SOCIAL_AI_PROVIDER) ?? 'gemini';

export type AiModule = 'social' | 'vision';

export async function preferredProvider(module: AiModule): Promise<AiProviderId> {
  if (module === 'vision') return 'gemini';
  const overrides = await store.get('aiOverrides');
  return asProvider(overrides[module]) ?? ENV_SOCIAL;
}

/** Fallback chain for a module: preferred → gemini → offline. */
export async function providerChain(module: AiModule): Promise<TextProvider[]> {
  const preferred = await preferredProvider(module);
  const chain: TextProvider[] = [];
  const push = (p: TextProvider) => {
    if (!chain.includes(p)) chain.push(p);
  };
  push(PROVIDERS[preferred]);
  push(PROVIDERS.gemini);
  push(PROVIDERS.offline);
  return chain;
}

export async function rememberProvider(fn: string, provider: AiProviderId) {
  await store.update('aiLastProvider', (prev) => ({ ...prev, [fn]: provider }));
}
