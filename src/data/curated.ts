// Curated offline content: the demo must never break if AI is slow or down.
import type { CharacterId, QuizQuestion, RiddleChallenge } from '@/core/types';

export const QUOTES: Record<CharacterId, string[]> = {
  red: [
    'Stay on the path. The shortcuts are where the wolves are.',
    'Every chapter you finish is one more snack in the basket.',
    'Grandma didn’t raise a quitter. Keep walking.',
    'The woods are dark, but the path is right there under your feet.',
  ],
  cinderella: [
    'Even Cinderella had a deadline: midnight.',
    'A pumpkin becomes a carriage with a little magic and a lot of showing up.',
    'The slipper only fits the one who kept dancing.',
    'You don’t need a fairy godmother. You need the next 25 minutes.',
  ],
  wolf: [
    'Build the brick house. Straw never survives the exam.',
    'Huff. Puff. Finish the problem set.',
    'The pigs that planned ahead are the pigs that made it.',
    'Big eyes are for reading. Big teeth are for deadlines.',
  ],
  duck: [
    'ugly duckling today. swan by finals. honk.',
    'paddle calm on top, kick like crazy underneath.',
    'bread is temporary. knowledge is forever. honk.',
    'if it quacks like procrastination, it is procrastination.',
  ],
  humpty: [
    'All the king’s horses couldn’t do it, but you can. One page at a time.',
    'A crack is not a fall. Keep sitting.',
    'The wall is tall. So are you. Metaphorically.',
    'Fragile things can still be brave.',
  ],
  poseidon: [
    'Calm seas never made a skilled sailor. Keep rowing.',
    'The tide comes in one wave at a time. So does knowledge.',
    'Even the ocean was once a single drop.',
    'Steer the ship. Do not let the current steer you.',
  ],
  bat: [
    'The night is long, but so is your attention span. Use it.',
    'Listen closely: every chapter echoes into the exam.',
    'Even in the dark, you know which way to fly.',
    'Hang in there. Upside down if you must.',
  ],
  witch: [
    'Every great potion starts with one boring ingredient. Add it.',
    'Focus is the only spell that never wears off.',
    'Stir slowly. Good brews and good grades take time.',
    'A witch never skips the reading. The spellbook knows.',
  ],
};

export const RIDDLES: RiddleChallenge[] = [
  {
    type: 'riddle',
    prompt: 'I strike twelve and ruin a perfectly good party. What am I?',
    answers: ['clock', 'midnight', 'the clock', 'a clock'],
    hint: 'Cinderella hates me.',
  },
  {
    type: 'riddle',
    prompt: 'I have a crown but no kingdom, and I’m sometimes golden. You eat my core. What am I?',
    answers: ['apple', 'an apple'],
    hint: 'Snow White took a bite.',
  },
  {
    type: 'riddle',
    prompt: 'The more you take from me, the bigger I get. What am I?',
    answers: ['hole', 'a hole'],
  },
  {
    type: 'riddle',
    prompt: 'I huff, I puff, but I’m not out of breath. I knock down houses with a single breath. What am I?',
    answers: ['wolf', 'the wolf', 'big bad wolf', 'the big bad wolf', 'wind'],
  },
  {
    type: 'riddle',
    prompt: 'I sat on a wall, I had a great fall. What am I?',
    answers: ['humpty dumpty', 'humpty', 'egg', 'an egg'],
  },
  {
    type: 'riddle',
    prompt: 'Mirror, mirror — what gets wetter the more it dries?',
    answers: ['towel', 'a towel'],
  },
  {
    type: 'riddle',
    prompt: 'I climb high on a single stalk, trading a cow for the chance. What am I?',
    answers: ['beanstalk', 'a beanstalk', 'jack', 'the beanstalk'],
  },
  {
    type: 'riddle',
    prompt: 'What has keys but opens no locks, and a spell every student fears?',
    answers: ['keyboard', 'a keyboard', 'piano'],
  },
  {
    type: 'riddle',
    prompt: 'I’m spun from straw into gold by someone whose name you must guess. What is his name?',
    answers: ['rumpelstiltskin', 'rumplestiltskin'],
  },
  {
    type: 'riddle',
    prompt: 'What can run but never walks, has a bed but never sleeps?',
    answers: ['river', 'a river'],
  },
];

export const OATHS = [
  'I solemnly swear to stay on the path.',
  'I will not watch one more video until the chapter is done.',
  'My tabs are pumpkins until midnight is averted.',
  'I am a brick house, not a straw house.',
  'The duck is watching and I will behave.',
  'I shall not make Humpty fall again.',
  'The scroll of doom shall not claim me today.',
];

/** Generic study quiz used when AI is unavailable. Topic-agnostic on purpose. */
export const FALLBACK_QUIZ: QuizQuestion[] = [
  {
    question: 'What is the most effective way to retain what you just read?',
    options: ['Reread it five times', 'Test yourself on it', 'Highlight everything', 'Open YouTube'],
    correctIndex: 1,
  },
  {
    question: 'How long is a classic Pomodoro focus block?',
    options: ['10 minutes', '25 minutes', '60 minutes', 'Until midnight'],
    correctIndex: 1,
  },
  {
    question: 'Spacing your study sessions over days instead of cramming is called…',
    options: ['Procrastination', 'Spaced repetition', 'Multitasking', 'A fairy tale'],
    correctIndex: 1,
  },
];

export const FALLBACK_FLASHCARDS = [
  { front: 'Active recall', back: 'Retrieving information from memory instead of rereading it.' },
  { front: 'Spaced repetition', back: 'Reviewing material at increasing intervals over time.' },
  { front: 'Pomodoro', back: '25 minutes of focus followed by a 5 minute break.' },
  { front: 'Interleaving', back: 'Mixing different topics or problem types in one session.' },
];

export const ICEBREAKERS = [
  'If your study topic were a fairytale villain, who would it be and why?',
  'What’s the snack you’d pack in Red’s basket for a long study night?',
  'Glass slipper or seven-league boots: which would help you more this week?',
  'What’s one thing you learned today that surprised you?',
  'Describe your current assignment as a quest. What’s the dragon?',
];

export const FRIEND_CHALLENGES = [
  { prompt: 'Type the name of the fairytale villain who huffs and puffs.', answers: ['wolf', 'the wolf', 'big bad wolf', 'the big bad wolf'] },
  { prompt: 'Finish the line: “Mirror, mirror, on the ____.”', answers: ['wall'] },
  { prompt: 'How many dwarfs did Snow White live with? (digits)', answers: ['7', 'seven'] },
  { prompt: 'What did Cinderella leave behind at the ball?', answers: ['slipper', 'glass slipper', 'a slipper', 'shoe', 'a shoe', 'her slipper'] },
];

export const GROUP_REPLIES = [
  'Great question for the group! Let’s break it down together: what do we already know, and what’s the one piece we’re missing?',
  'Here’s a quick way to think about it: define the terms, find the relationship, then test it with one example.',
  'Let’s turn that into a flashcard so everyone in the room remembers it.',
];
