// Provider-neutral AI interface. Feature code never imports a provider SDK —
// it only talks to `visionAI` / `socialAI`, which route to a TextProvider.
import type { ZodType } from 'zod';
import type { AiProviderId } from '@/core/types';

export interface ImagePart {
  image: { mimeType: string; dataBase64: string };
}
export type ContentPart = string | ImagePart;

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

export interface ChatOptions {
  /** Hint: use the cheapest/fastest model available */
  tier?: 'fast' | 'quality';
  temperature?: number;
  maxTokens?: number;
  /** Abort after this many ms (provider should reject) */
  timeoutMs?: number;
}

export interface TextProvider {
  id: AiProviderId;
  /** True when a key/config is present. Cheap, synchronous. */
  isConfigured(): boolean;
  chat(messages: AiMessage[], options?: ChatOptions): Promise<string>;
  /**
   * Ask for JSON matching `schema`. Implementations should use native JSON
   * mode if available; the caller validates with zod regardless.
   */
  json<T>(messages: AiMessage[], schema: ZodType<T>, options?: ChatOptions): Promise<T>;
}

export class ProviderError extends Error {
  constructor(
    public provider: AiProviderId,
    message: string,
    public status?: number,
  ) {
    super(`[${provider}] ${message}`);
  }
}

export class NotConfiguredError extends ProviderError {
  constructor(provider: AiProviderId) {
    super(provider, 'not configured (missing API key)');
  }
}

export interface AiResult<T> {
  data: T;
  /** Who actually answered: 'gemini' | 'offline' */
  provider: AiProviderId;
  ms: number;
}

export const PROVIDER_LABEL: Record<AiProviderId, string> = {
  gemini: 'Powered by Gemini',
  offline: 'Offline storybook',
};
