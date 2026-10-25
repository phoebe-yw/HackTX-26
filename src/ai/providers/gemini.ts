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

let client: GoogleGenAI | null = null;
/** When we get a 429 we pause this provider briefly so the fallback chain kicks in. */
let cooldownUntil = 0;

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
  if (Date.now() < cooldownUntil) {
    throw new ProviderError('gemini', 'cooling down after rate limit', 429);
  }
  const ai = getClient();
  const { system, contents } = toContents(messages);
  const model = options.tier === 'fast' ? LITE_MODEL : MODEL;
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
        maxOutputTokens: options.maxTokens ?? 1024,
        abortSignal: controller.signal,
        ...(options.jsonSchema
          ? { responseMimeType: 'application/json', responseJsonSchema: options.jsonSchema }
          : {}),
      },
    });
    const text = res.text ?? '';
    if (!text) throw new ProviderError('gemini', 'empty response');
    console.debug(`[gemini] ${model} ${Date.now() - t0}ms`);
    return text;
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    const status = /\b(429|RESOURCE_EXHAUSTED)\b/.test(msg)
      ? 429
      : /\b(4\d\d|5\d\d)\b/.exec(msg)?.[0]
        ? Number(/\b(4\d\d|5\d\d)\b/.exec(msg)![0])
        : undefined;
    if (status === 429) cooldownUntil = Date.now() + 30_000;
    throw new ProviderError('gemini', msg.slice(0, 300), status);
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
