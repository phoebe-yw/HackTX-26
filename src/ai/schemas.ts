import { z } from 'zod';

export const ScreenCheckSchema = z.object({
  on_task: z.boolean(),
  confidence: z.number().min(0).max(1),
  activity: z.string().max(120),
  roast_hook: z.string().max(60),
});
export type ScreenCheck = z.infer<typeof ScreenCheckSchema>;

export const SiteClassSchema = z.object({
  on_task: z.boolean(),
  confidence: z.number().min(0).max(1),
});

export const LineSchema = z.object({ line: z.string().max(200) });

export const QuizSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string(),
        options: z.array(z.string()).min(2).max(4),
        correctIndex: z.number().int().min(0).max(3),
      }),
    )
    .min(1)
    .max(3),
});

export const FlashcardsSchema = z.object({
  cards: z.array(z.object({ front: z.string(), back: z.string() })).min(1).max(12),
});

export const RiddleSchema = z.object({
  riddle: z.string(),
  answers: z.array(z.string()).min(1).max(6),
  hint: z.string().optional(),
});

export const ChallengeSchema = z.object({
  prompt: z.string().max(240),
  answers: z.array(z.string()).min(1).max(6),
});
