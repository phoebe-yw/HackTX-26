// Offline "provider": the end of every fallback chain. It can't run prompts,
// so socialAI/visionAI call the curated helpers directly when they land here.
import type { TextProvider } from '../types';
import { ProviderError } from '../types';

export const offlineProvider: TextProvider = {
  id: 'offline',
  isConfigured: () => true,
  async chat() {
    throw new ProviderError('offline', 'offline provider has no chat; use curated content');
  },
  async json() {
    throw new ProviderError('offline', 'offline provider has no json; use curated content');
  },
};
