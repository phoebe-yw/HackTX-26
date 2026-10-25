// ╔══════════════════════════════════════════════════════════════════════╗
// ║  META MUSE PROVIDER — STUB                                           ║
// ║  Not wired yet. Fill this in during Phase 6a using SWITCH_TO_META.md ║
// ║  once we have Meta's docs + key. Until then it reports "not          ║
// ║  configured" and the socialAI fallback chain routes to Gemini.       ║
// ╚══════════════════════════════════════════════════════════════════════╝
import type { ZodType } from 'zod';
import { parseWith, schemaInstruction } from '../json';
import {
  NotConfiguredError,
  ProviderError,
  type AiMessage,
  type ChatOptions,
  type TextProvider,
} from '../types';

const API_KEY = import.meta.env.WXT_META_API_KEY as string | undefined;
const BASE_URL = import.meta.env.WXT_META_BASE_URL as string | undefined;
const MODEL = import.meta.env.WXT_META_MODEL as string | undefined;

function configured(): boolean {
  return Boolean(API_KEY && BASE_URL && MODEL);
}

/**
 * TODO(meta): replace the body of this function with the real Muse Spark call.
 * Expected shape (verify against Meta's docs — DO NOT GUESS):
 *   POST `${BASE_URL}/...`  Authorization: Bearer ${API_KEY}
 *   body: { model: MODEL, messages: [{ role, content }], ... }
 * Return the assistant text.
 */
async function museChat(_messages: AiMessage[], _options: ChatOptions = {}): Promise<string> {
  if (!configured()) throw new NotConfiguredError('meta');
  throw new ProviderError('meta', 'museChat() not implemented yet — see SWITCH_TO_META.md');
}

export const metaProvider: TextProvider = {
  id: 'meta',
  isConfigured: configured,
  chat: (messages, options) => museChat(messages, options),
  async json<T>(messages: AiMessage[], schema: ZodType<T>, options?: ChatOptions): Promise<T> {
    // Provider-neutral JSON: we ask in the prompt and validate with zod, so this
    // works even if Muse has no native JSON mode.
    const text = await museChat(
      [...messages, { role: 'user', content: schemaInstruction(schema) }],
      options,
    );
    return parseWith(schema, text);
  },
};
