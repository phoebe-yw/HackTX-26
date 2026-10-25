// Provider-neutral prompts. Plain text, no SDK types. Keep lines short + in character.
import { CHARACTERS } from '@/data/characters';
import type { CharacterId } from '@/core/types';

export function characterSystem(characterId: CharacterId, petName: string): string {
  const c = CHARACTERS[characterId];
  return [
    `You are ${petName}, a tiny fairytale study companion living in the corner of a student's screen.`,
    `Character: ${c.voice}`,
    'Style rules: 1–2 sentences max. Funny, warm, never cruel. PG. No emojis unless the character would. Never mention being an AI or a language model.',
  ].join('\n');
}

export const screenCheckPrompt = (topic: string) =>
  [
    'You are a focus detector. Look at this screenshot of a student\'s browser tab.',
    `The student said they are studying: "${topic || 'general schoolwork'}".`,
    'Decide if what is visible is plausibly related to that study topic (notes, docs, lectures, problem sets, course sites, research, coding for a class, AI assistants being used for the topic all count as on task).',
    'Entertainment, social media, shopping, games, unrelated videos count as off task.',
    'Return JSON: on_task (boolean), confidence (0-1), activity (≤12 words, plain description of what they are doing, e.g. "watching a YouTube video about cats"), roast_hook (≤6 words, the most roastable concrete detail, e.g. "cat compilation").',
    'Do not transcribe private text. Do not include names, emails or numbers from the screen.',
  ].join('\n');

export const siteClassPrompt = (topic: string, url: string, title: string) =>
  [
    `A student is studying: "${topic || 'general schoolwork'}".`,
    `They opened a page. URL: ${url}\nTitle: ${title}`,
    'Is this page plausibly part of studying that topic (or general productivity like docs, notes, email for school, AI assistants)? Entertainment and social media are off task.',
    'Return JSON: on_task (boolean), confidence (0-1).',
  ].join('\n');

export const roastPrompt = (activity: string, roastHook: string, topic: string) =>
  [
    `The student is supposed to be studying "${topic || 'their coursework'}" but you caught them: ${activity}.`,
    `Roast them in character with ONE short, funny line that references "${roastHook}" specifically.`,
    'Return JSON: { "line": string }.',
  ].join('\n');

export const askPrompt = (topic: string, withScreen: boolean) =>
  [
    `The student is studying "${topic || 'their coursework'}".`,
    withScreen
      ? 'A screenshot of their current tab is attached. Answer their question about what is on screen clearly and helpfully. Stay in character in the first sentence, then be genuinely useful. Up to 6 sentences; use short bullet points if explaining steps.'
      : 'Answer helpfully and briefly, in character. Up to 4 sentences.',
  ].join('\n');

export const quizPrompt = (topic: string, n: number, difficulty: string) =>
  [
    `Write ${n} multiple-choice question(s) about: "${topic || 'effective study habits'}".`,
    `Difficulty: ${difficulty}. Each question has 3–4 options and exactly one correct answer. Keep questions crisp and answerable in under 20 seconds.`,
    'Return JSON: { questions: [{ question, options, correctIndex }] }.',
  ].join('\n');

export const flashcardsPrompt = (topic: string, notes: string, n: number) =>
  [
    `Create ${n} study flashcards for a group studying: "${topic}".`,
    notes ? `Base them on these notes:\n"""${notes.slice(0, 4000)}"""` : 'Cover the most important concepts a student should know.',
    'Front: a term or question (≤12 words). Back: a clear answer (≤30 words).',
    'Return JSON: { cards: [{ front, back }] }.',
  ].join('\n');

export const riddlePrompt = () =>
  [
    'Write ONE original short riddle with a fairytale flavor (castles, wolves, slippers, mirrors, beanstalks, spells).',
    'It should be solvable by a tired student in under a minute. Provide 2–5 acceptable one-or-two-word answers (lowercase, including obvious variants like "clock" and "a clock").',
    'Return JSON: { riddle, answers, hint }.',
  ].join('\n');

export const icebreakerPrompt = (topicA: string, topicB: string) =>
  [
    `Two students just got matched for a 3-minute study break game. One is studying "${topicA || 'something'}", the other "${topicB || 'something else'}".`,
    'Write ONE playful fairytale-flavored icebreaker question they can both answer in a sentence. ≤25 words.',
    'Return JSON: { "line": string }.',
  ].join('\n');

export const friendChallengePrompt = (fromName: string, toName: string, topic: string) =>
  [
    `${fromName} wants to send their friend ${toName} a short, funny challenge that will appear when ${toName} gets caught procrastinating.`,
    `${toName} is studying "${topic || 'something'}". The challenge should be a one-line question or task with a short typed answer (a word or number). It can be about the topic, fairytales, or a silly dare like "type 'I am a brick house' three times".`,
    'Provide acceptable answers (lowercase variants).',
    'Return JSON: { prompt, answers }.',
  ].join('\n');

export const quotePrompt = (topic: string) =>
  [
    `Write ONE original motivational quote in character, fairytale-flavored, for a student studying "${topic || 'hard things'}". ≤22 words. No attribution.`,
    'Return JSON: { "line": string }.',
  ].join('\n');

export const groupReplyPrompt = (topic: string, members: string[]) =>
  [
    `You are the AI tutor in a group study room. Members: ${members.join(', ') || 'a few students'}. Topic: "${topic || 'general'}".`,
    'Answer the latest message for the whole group: clear, friendly, concise (≤120 words). Address people by name when they asked. If a concept would make a good flashcard, say so in one short sentence at the end.',
  ].join('\n');
