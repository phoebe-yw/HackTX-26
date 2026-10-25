import type { Mark } from './types';

/** Fairytale-flavored 5-letter answers for Spellbound. */
export const ANSWERS = [
  'witch', 'crown', 'tower', 'fairy', 'giant', 'spell', 'troll', 'dwarf', 'charm', 'queen',
  'sword', 'beast', 'frogs', 'apple', 'wands', 'genie', 'magic', 'robin', 'ogres', 'steed',
  'quest', 'curse', 'crone', 'dream', 'glass', 'horse', 'cloak', 'woods', 'lamps', 'bread',
  'crumb', 'goose', 'swans', 'pearl', 'thorn', 'roses', 'brick', 'straw', 'howls', 'ducks',
  'shell', 'kings', 'knave', 'siren', 'elves', 'feast', 'realm', 'tiara', 'spoon', 'moats',
];

export function randomWord(): string {
  return ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
}

/** Wordle-style scoring with correct duplicate handling. */
export function score(guess: string, answer: string): Mark[] {
  const g = guess.toLowerCase().split('');
  const a = answer.toLowerCase().split('');
  const marks: Mark[] = Array(5).fill('x');
  const remaining: Record<string, number> = {};
  for (let i = 0; i < 5; i++) {
    if (g[i] === a[i]) marks[i] = 'g';
    else remaining[a[i]] = (remaining[a[i]] ?? 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (marks[i] === 'g') continue;
    if (remaining[g[i]] > 0) {
      marks[i] = 'y';
      remaining[g[i]] -= 1;
    }
  }
  return marks;
}

export function isValidGuess(w: string): boolean {
  return /^[a-z]{5}$/i.test(w);
}
