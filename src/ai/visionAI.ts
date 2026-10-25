// visionAI — the pet's EYES. Always Gemini (our Gemini-track feature).
// checkScreen() / roast() / askAboutScreen() / classifySite()
import type { CharacterId } from '@/core/types';
import { CHARACTERS, pick } from '@/data/characters';
import { runChain } from './chain';
import * as P from './prompts';
import { LineSchema, ScreenCheckSchema, SiteClassSchema, type ScreenCheck } from './schemas';
import type { AiResult } from './types';

export interface PetContext {
  characterId: CharacterId;
  petName: string;
  topic: string;
}

export interface Screenshot {
  mimeType: string;
  dataBase64: string;
}

export async function checkScreen(
  shot: Screenshot,
  ctx: PetContext,
): Promise<AiResult<ScreenCheck | null>> {
  return runChain(
    'vision',
    'checkScreen',
    (p) =>
      p.json(
        [
          {
            role: 'user',
            content: [P.screenCheckPrompt(ctx.topic), { image: shot }],
          },
        ],
        ScreenCheckSchema,
        { temperature: 0.2, timeoutMs: 12_000, maxTokens: 200 },
      ),
    () => null, // no offline answer for vision: caller treats null as "unknown"
  );
}

export async function classifySite(
  url: string,
  title: string,
  ctx: PetContext,
): Promise<AiResult<{ on_task: boolean; confidence: number } | null>> {
  return runChain(
    'vision',
    'classifySite',
    (p) =>
      p.json([{ role: 'user', content: P.siteClassPrompt(ctx.topic, url, title) }], SiteClassSchema, {
        tier: 'fast',
        temperature: 0.1,
        timeoutMs: 8_000,
        maxTokens: 60,
      }),
    () => null,
  );
}

export async function roast(
  activity: string,
  roastHook: string,
  ctx: PetContext,
): Promise<AiResult<string>> {
  return runChain(
    'vision',
    'roast',
    async (p) => {
      const r = await p.json(
        [
          { role: 'system', content: P.characterSystem(ctx.characterId, ctx.petName) },
          { role: 'user', content: P.roastPrompt(activity, roastHook, ctx.topic) },
        ],
        LineSchema,
        { temperature: 1.0, timeoutMs: 8_000, maxTokens: 120 },
      );
      return r.line;
    },
    () => pick(CHARACTERS[ctx.characterId].lines[2]),
  );
}

export async function askAboutScreen(
  question: string,
  shot: Screenshot | null,
  history: { role: 'user' | 'assistant'; content: string }[],
  ctx: PetContext,
): Promise<AiResult<string>> {
  return runChain(
    'vision',
    'ask',
    (p) =>
      p.chat(
        [
          { role: 'system', content: P.characterSystem(ctx.characterId, ctx.petName) },
          { role: 'system', content: P.askPrompt(ctx.topic, Boolean(shot)) },
          ...history.slice(-8),
          {
            role: 'user',
            content: shot ? [question, { image: shot }] : question,
          },
        ],
        { temperature: 0.7, timeoutMs: 25_000, maxTokens: 700 },
      ),
    () =>
      shot
        ? `${pick(CHARACTERS[ctx.characterId].lines.sulk)} (My eyes are tired — the AI didn't answer. Try again in a moment.)`
        : `${pick(CHARACTERS[ctx.characterId].lines.encourage)} (I can't reach my spellbook right now — try again shortly.)`,
  );
}
