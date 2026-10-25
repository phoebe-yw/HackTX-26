// "Mysterious Stranger" bot for Demo Mode / offline: plays Spellbound at a human-ish pace.
import type { Guess, Mark } from './types';
import { ANSWERS, score } from './words';

function consistent(candidate: string, guesses: Guess[]): boolean {
  return guesses.every((g) => {
    const m = score(g.word, candidate);
    return m.every((mark: Mark, i) => mark === g.marks[i]);
  });
}

/** Pick the bot's next guess given its previous guesses. Sometimes deliberately dumb. */
export function botNextGuess(prev: Guess[], answer: string): string {
  const pool = ANSWERS.filter((w) => !prev.some((g) => g.word === w));
  const smart = pool.filter((w) => consistent(w, prev));
  // 35% of the time the bot "misreads a rune" and picks a random word to keep it beatable
  if (Math.random() < 0.35 || smart.length === 0) return pool[Math.floor(Math.random() * pool.length)] ?? answer;
  return smart[Math.floor(Math.random() * smart.length)];
}

export const BOT_LINES = {
  greet: ['Hark! A fellow traveler. Shall we race?', 'Ah, another scholar on break. Prepare to lose.', '*adjusts cloak* Spellbound, is it? Lovely.'],
  guess: ['Hmm, runes…', 'My quill trembles.', 'That one felt right.', 'The letters mock me.'],
  move: ['Your move, scholar.', 'Bold. Very bold.', 'I saw that coming.', 'Hmm… interesting.', 'The board favours the patient.'],
  win: ['Victory! The tavern keeper owes me a drink.', 'Spell broken. Better luck next break.'],
  lose: ['Well played, scholar. Well played.', 'You bested me. Shall we be friends?'],
  reply: [
    'Ha! True enough.',
    'Spoken like a true scholar.',
    'I study medieval literature, mostly dragons.',
    'Breaks are better with company, no?',
    'Tell me more after this word.',
  ],
};
