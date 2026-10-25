// Chooses which provider backs each AI module. Env sets the default; the hidden
// Dev panel can override live (stored in chrome.storage `aiOverrides`).
import type { AiProviderId } from '@/core/types';
import * as store from '@/core/storage';
import { geminiProvider } from './providers/gemini';
import { metaProvider } from './providers/meta';
import { offlineProvider } from './providers/offline';
import type { TextProvider } from './types';

export const PROVIDERS: Record<AiProviderId, TextProvider> = {
  gemini: geminiProvider,
  meta: metaProvider,
  offline: offlineProvider,
};

const ENV_SOCIAL = ((import.meta.env.WXT_SOCIAL_AI_PROVIDER as string) || 'gemini') as AiProviderId;
const ENV_VISION = ((import.meta.env.WXT_VISION_AI_PROVIDER as string) || 'gemini') as AiProviderId;

export type AiModule = 'social' | 'vision';

export async function preferredProvider(module: AiModule): Promise<AiProviderId> {
  const overrides = await store.get('aiOverrides');
  const o = overrides[module];
  if (o) return o;
  return module === 'social' ? ENV_SOCIAL : ENV_VISION;
}

/**
 * Fallback chain for a module. Vision is Gemini-only by design (it's our
 * Gemini-track feature). Social: preferred → gemini → offline.
 */
export async function providerChain(module: AiModule): Promise<TextProvider[]> {
  const preferred = await preferredProvider(module);
  if (module === 'vision') {
    return [PROVIDERS.gemini, PROVIDERS.offline];
  }
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
