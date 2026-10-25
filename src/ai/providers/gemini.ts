// Gemini provider — the ONLY file that imports the Google Gen AI SDK.
import { GoogleGenAI, type Content, type Part } from '@google/genai';
import type { ZodType } from 'zod';
import { parseWith, schemaInstruction, schemaToJsonSchema } from '../json';
import {
  NotConfiguredError,
  ProviderError,
  type AiMessage,
  type ChatOptions,
  type TextProvider,
} from '../types';

const API_KEY = import.meta.env.WXT_GEMINI_API_KEY as string | undefined;
// Model ids confirmed against https://ai.google.dev/gemini-api/docs/models (2026-10-24)
const MODEL = (import.meta.env.WXT_GEMINI_MODEL as string | undefined) || 'gemini-3.8-flash';
const LITE_MODEL =
  (import.meta.env.WXT_GEMINI_LITE_MODEL as string | undefined) || 'gemini-3.5-flash-lite';

// Each model has its own free-tier daily quota, so when one is exhausted we move
// down the ladder. Ids verified against the models list for our key (2026-10-25).
const QUALITY_LADDER = dedupe([
  MODEL,
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  LITE_MODEL,
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
]);
const FAST_LADDER = dedupe([LITE_MODEL, 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash']);

let client: GoogleGenAI | null = null;
/** Per-model "don't call until" timestamps after 429 / 404 / 503. */
const restingUntil = new Map<string, number>();

function dedupe(xs: string[]): string[] {
  return [...new Set(xs.filter(Boolean))];
}

/** How long to rest a model, from Google's "retry in 1h52m1.3s" / retryDelay "6721s". */
function restMs(msg: string): number {
  const delay = /retryDelay"?\s*:\s*"(\d+)s/.exec(msg);
  if (delay) return Number(delay[1]) * 1000;
  const human = /retry in ((?:\d+h)?(?:\d+m)?(?:[\d.]+s)?)/i.exec(msg)?.[1];
  if (human) {
    const h = Number(/(\d+)h/.exec(human)?.[1] ?? 0);
    const m = Number(/(\d+)m/.exec(human)?.[1] ?? 0);
    const s = Number(/([\d.]+)s/.exec(human)?.[1] ?? 0);
    const total = (h * 3600 + m * 60 + s) * 1000;
    if (total > 0) return total;
  }
  return 60_000;
}

function getClient(): GoogleGenAI {
  if (!API_KEY) throw new NotConfiguredError('gemini');
  if (!client) client = new GoogleGenAI({ apiKey: API_KEY });
  return client;
}

function toContents(messages: AiMessage[]): { system?: string; contents: Content[] } {
  const systemParts: string[] = [];
  const contents: Content[] = [];
  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push(typeof m.content === 'string' ? m.content : partsToText(m.content));
      continue;
    }
    const parts: Part[] =
      typeof m.content === 'string'
        ? [{ text: m.content }]
        : m.content.map((p) =>
            typeof p === 'string'
              ? { text: p }
              : { inlineData: { mimeType: p.image.mimeType, data: p.image.dataBase64 } },
          );
    contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts });
  }
  return { system: systemParts.length ? systemParts.join('\n\n') : undefined, contents };
}

function partsToText(parts: AiMessage['content']): string {
  if (typeof parts === 'string') return parts;
  return parts.map((p) => (typeof p === 'string' ? p : '[image]')).join('\n');
}

async function generate(
  messages: AiMessage[],
  options: ChatOptions & { jsonSchema?: Record<string, unknown> } = {},
): Promise<string> {
  const ladder = options.tier === 'fast' ? FAST_LADDER : QUALITY_LADDER;
  const budget = (options.timeoutMs ?? 20_000) * 2;
  // Overloaded models sometimes hang instead of returning 503; a healthy one answers in 2-6s
  const perTry = Math.min(options.timeoutMs ?? 20_000, 12_000);
  const deadline = Date.now() + budget;
  let last: ProviderError | null = null;
  for (const model of ladder) {
    if (Date.now() < (restingUntil.get(model) ?? 0)) continue;
    const remaining = deadline - Date.now();
    if (remaining < 3_000) break;
    try {
      return await generateWith(model, messages, { ...options, timeoutMs: Math.min(perTry, remaining) });
    } catch (err) {
      if (!(err instanceof ProviderError)) throw err;
      last = err;
      // 400/401/403 mean the request or key is wrong; another model won't help
      if (err.status === 400 || err.status === 401 || err.status === 403) throw err;
      const rest =
        err.status === 429 || err.status === 503
          ? restMs(err.message)
          : err.status === 404
            ? 3600_000
            : 15 * 60_000;
      restingUntil.set(model, Date.now() + rest);
      console.warn(`[gemini] ${model} unavailable (${err.status ?? err.message}), trying the next model`);
    }
  }
  throw last ?? new ProviderError('gemini', 'every model is resting after rate limits', 429);
}

async function generateWith(
  model: string,
  messages: AiMessage[],
  options: ChatOptions & { jsonSchema?: Record<string, unknown> },
): Promise<string> {
  const ai = getClient();
  const { system, contents } = toContents(messages);
  const timeoutMs = options.timeoutMs ?? 20_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: system,
        temperature: options.temperature ?? 0.9,
        // Thinking models spend output tokens before answering; prompts keep replies short
        maxOutputTokens: Math.max(options.maxTokens ?? 1024, 2048),
        abortSignal: controller.signal,
        ...(options.jsonSchema
          ? { responseMimeType: 'application/json', responseJsonSchema: options.jsonSchema }
          : {}),
      },
    });
    const text = res.text ?? '';
    if (!text) throw new ProviderError('gemini', 'empty response');
    console.info(`[gemini] ${model} ${Date.now() - t0}ms`);
    return text;
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if (controller.signal.aborted) throw new ProviderError('gemini', `${model} timed out after ${timeoutMs}ms`, 408);
    const msg = err instanceof Error ? err.message : String(err);
    const status = /\b(429|RESOURCE_EXHAUSTED)\b/.test(msg)
      ? 429
      : /\bNOT_FOUND\b/.test(msg)
        ? 404
        : /\b(4\d\d|5\d\d)\b/.exec(msg)?.[0]
          ? Number(/\b(4\d\d|5\d\d)\b/.exec(msg)![0])
          : undefined;
    // Keep the whole message for 429s: the retry delay is near the end
    throw new ProviderError('gemini', status === 429 ? msg : msg.slice(0, 300), status);
  } finally {
    clearTimeout(timer);
  }
}

export const geminiProvider: TextProvider = {
  id: 'gemini',
  isConfigured: () => Boolean(API_KEY),
  chat: (messages, options) => generate(messages, options),
  async json<T>(messages: AiMessage[], schema: ZodType<T>, options?: ChatOptions): Promise<T> {
    const withInstruction: AiMessage[] = [
      ...messages,
      { role: 'user', content: schemaInstruction(schema) },
    ];
    let text: string;
    try {
      text = await generate(withInstruction, {
        ...options,
        temperature: options?.temperature ?? 0.7,
        jsonSchema: schemaToJsonSchema(schema),
      });
    } catch (err) {
      // If the schema itself was rejected (400), retry with prompt-only JSON.
      if (err instanceof ProviderError && err.status === 400) {
        text = await generate(withInstruction, { ...options, temperature: 0.7 });
      } else throw err;
    }
    return parseWith(schema, text);
  },
};
