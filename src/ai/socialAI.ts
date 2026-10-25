// socialAI — the SOCIAL BRAIN (Gemini, with the offline storybook as fallback).
// groupReply() / generateFlashcards() / generateQuiz() / icebreaker() /
// generateChallenge() / quote() / riddle()
import type { CharacterId, QuizQuestion, RiddleChallenge } from '@/core/types';
import { CHARACTERS, pick } from '@/data/characters';
import {
  FALLBACK_FLASHCARDS,
  FALLBACK_QUIZ,
  FRIEND_CHALLENGES,
  GROUP_REPLIES,
  ICEBREAKERS,
  QUOTES,
  RIDDLES,
} from '@/data/curated';
import { runChain } from './chain';
import * as P from './prompts';
import { ChallengeSchema, FlashcardsSchema, LineSchema, QuizSchema, RiddleSchema } from './schemas';
import type { AiMessage, AiResult } from './types';

export interface Flashcard {
  front: string;
  back: string;
}

export async function groupReply(
  topic: string,
  members: string[],
  transcript: { name: string; text: string; isAI?: boolean }[],
): Promise<AiResult<string>> {
  const history: AiMessage[] = transcript.slice(-12).map((m) => ({
    role: m.isAI ? 'assistant' : 'user',
    content: m.isAI ? m.text : `${m.name}: ${m.text}`,
  }));
  return runChain(
    'social',
    'groupReply',
    (p) =>
      p.chat([{ role: 'system', content: P.groupReplyPrompt(topic, members) }, ...history], {
        temperature: 0.7,
        timeoutMs: 20_000,
        maxTokens: 400,
      }),
    () => pick(GROUP_REPLIES),
  );
}

export async function generateFlashcards(
  topic: string,
  notes = '',
  n = 6,
): Promise<AiResult<Flashcard[]>> {
  return runChain(
    'social',
    'generateFlashcards',
    async (p) =>
      (await p.json([{ role: 'user', content: P.flashcardsPrompt(topic, notes, n) }], FlashcardsSchema, {
        temperature: 0.6,
        timeoutMs: 20_000,
        maxTokens: 900,
      })).cards,
    () => FALLBACK_FLASHCARDS,
  );
}

export async function generateQuiz(
  topic: string,
  n = 2,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
): Promise<AiResult<QuizQuestion[]>> {
  return runChain(
    'social',
    'generateQuiz',
    async (p) => {
      const r = await p.json([{ role: 'user', content: P.quizPrompt(topic, n, difficulty) }], QuizSchema, {
        temperature: 0.6,
        timeoutMs: 12_000,
        maxTokens: 600,
      });
      // guard: correctIndex must point inside options
      const ok = r.questions.filter((q) => q.correctIndex < q.options.length);
      if (!ok.length) throw new Error('quiz had no valid questions');
      return ok;
    },
    () => FALLBACK_QUIZ.slice(0, n),
  );
}

export async function riddle(): Promise<AiResult<RiddleChallenge>> {
  return runChain(
    'social',
    'riddle',
    async (p) => {
      const r = await p.json([{ role: 'user', content: P.riddlePrompt() }], RiddleSchema, {
        temperature: 1.0,
        timeoutMs: 10_000,
        maxTokens: 200,
      });
      return { type: 'riddle', prompt: r.riddle, answers: r.answers.map((a) => a.toLowerCase()), hint: r.hint };
    },
    () => pick(RIDDLES),
  );
}

export async function icebreaker(topicA: string, topicB: string): Promise<AiResult<string>> {
  return runChain(
    'social',
    'icebreaker',
    async (p) =>
      (await p.json([{ role: 'user', content: P.icebreakerPrompt(topicA, topicB) }], LineSchema, {
        temperature: 1.0,
        timeoutMs: 10_000,
        maxTokens: 100,
      })).line,
    () => pick(ICEBREAKERS),
  );
}

export async function generateChallenge(
  fromName: string,
  toName: string,
  topic: string,
): Promise<AiResult<{ prompt: string; answers: string[] }>> {
  return runChain(
    'social',
    'generateChallenge',
    async (p) => {
      const r = await p.json(
        [{ role: 'user', content: P.friendChallengePrompt(fromName, toName, topic) }],
        ChallengeSchema,
        { temperature: 1.0, timeoutMs: 10_000, maxTokens: 200 },
      );
      return { prompt: r.prompt, answers: r.answers.map((a) => a.toLowerCase()) };
    },
    () => pick(FRIEND_CHALLENGES),
  );
}

export async function quote(characterId: CharacterId, petName: string, topic: string): Promise<AiResult<string>> {
  return runChain(
    'social',
    'quote',
    async (p) =>
      (await p.json(
        [
          { role: 'system', content: P.characterSystem(characterId, petName) },
          { role: 'user', content: P.quotePrompt(topic) },
        ],
        LineSchema,
        { tier: 'fast', temperature: 1.0, timeoutMs: 8_000, maxTokens: 80 },
      )).line,
    () => pick(QUOTES[characterId]),
  );
}

/** Dev panel: call every socialAI function once and report pass/fail. */
export async function selfTest(): Promise<
  { fn: string; ok: boolean; provider: string; ms: number; error?: string }[]
> {
  const tests: [string, () => Promise<AiResult<unknown>>][] = [
    ['groupReply', () => groupReply('photosynthesis', ['Ana', 'Ben'], [{ name: 'Ana', text: 'what does the Calvin cycle do?' }])],
    ['generateFlashcards', () => generateFlashcards('photosynthesis', '', 3)],
    ['generateQuiz', () => generateQuiz('photosynthesis', 1)],
    ['riddle', () => riddle()],
    ['icebreaker', () => icebreaker('calculus', 'art history')],
    ['generateChallenge', () => generateChallenge('Ana', 'Ben', 'calculus')],
    ['quote', () => quote('cinderella', 'Ella', 'calculus')],
  ];
  const out = [];
  for (const [fn, run] of tests) {
    const t0 = Date.now();
    try {
      const r = await run();
      out.push({ fn, ok: r.provider !== 'offline', provider: r.provider, ms: Date.now() - t0 });
    } catch (e) {
      out.push({ fn, ok: false, provider: '-', ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}