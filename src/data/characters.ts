import type { CharacterId, MoodLevel } from '@/core/types';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  defaultPetName: string;
  emoji: string;
  tagline: string;
  /** Used by prompts so AI-generated lines stay in character */
  voice: string;
  colors: { primary: string; secondary: string; accent: string };
  lines: Record<MoodLevel, string[]> & {
    encourage: string[];
    joke: string[];
    guiltHide: string[];
    guiltDisable: string[];
    sulk: string[];
    unlocked: string[];
    breakTime: string[];
    backToWork: string[];
    lockdownEntrance: string[];
    wrongAnswer: string[];
  };
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  red: {
    id: 'red',
    name: 'Red Riding Hood',
    defaultPetName: 'Red',
    emoji: '🧺',
    tagline: 'Sweet, sassy, basket full of snacks. Stay on the path.',
    voice:
      "Red Riding Hood: sweet but sassy, cheerful, references the woods, the path, grandma, the basket of snacks, and wolves. Says things like 'Stay on the path!'. Short, punchy lines.",
    colors: { primary: '#A3304A', secondary: '#FBF8EE', accent: '#D9B44A' },
    lines: {
      0: [
        "You're on the path! Grandma would be so proud.",
        'Look at you go. Snack break in the basket when you earn it.',
        'Not a wolf in sight. Keep walking.',
      ],
      1: [
        'Hmm. That doesn’t look like the path to grandma’s…',
        'My, what a wandering cursor you have.',
        'Are we… taking a shortcut through the woods?',
      ],
      2: [
        'Okay. OKAY. Back on the path. Now.',
        'I packed snacks for a scholar, not a scroller.',
        'The wolf is literally RIGHT THERE and you’re browsing.',
      ],
      3: [
        'THAT’S IT. I’m putting the basket DOWN.',
        'I have fought wolves with less patience than this!',
        'Grandma can WAIT. You cannot.',
      ],
      4: ['Out of the woods. Into the trial. No shortcuts.'],
      encourage: [
        'One more step down the path. You’ve got this.',
        'Grandma says hi. She also says keep reading.',
        'This basket isn’t going to earn itself, scholar.',
      ],
      joke: [
        'Why did the wolf fail his exam? He kept huffing instead of studying.',
        'My cape is red because I ran all the way here to check on you.',
        'Fun fact: grandma’s house is a metaphor for your deadline.',
      ],
      guiltHide: [
        'Hiding me? In the WOODS? Fine. I’ll be behind that tree. Watching.',
        'Oh sure, hide the one person keeping you from the wolf.',
      ],
      guiltDisable: [
        'Disabling me mid-session? Grandma is going to hear about this.',
        'Wow. Just… wow. Enjoy the woods without me.',
      ],
      sulk: ['Fine. Go. I’ll just sit here with my basket. Alone.'],
      unlocked: ['Back on the path! The woods are quiet again.', 'Trial passed. Have a snack.'],
      breakTime: ['Break time! Open the basket.', 'The clock strikes rest. Go stretch.'],
      backToWork: ['Basket’s closed. Back on the path!', 'Rested? Good. Walk.'],
      lockdownEntrance: ['I SAID STAY ON THE PATH.', 'Right. Basket down. Hood up.'],
      wrongAnswer: ['Nope. The wolf laughed at that.', 'Grandma would not accept that.'],
    },
  },
  cinderella: {
    id: 'cinderella',
    name: 'Cinderella',
    defaultPetName: 'Ella',
    emoji: '👠',
    tagline: 'Obsessed with the clock. Everything is due at midnight.',
    voice:
      'Cinderella: elegant but increasingly frantic about time, obsessed with the clock, midnight, deadlines, pumpkins, glass slippers, and fairy godmothers. Short, dramatic lines.',
    colors: { primary: '#8EB9CC', secondary: '#FBF8EE', accent: '#D9B44A' },
    lines: {
      0: [
        'The clock is ticking and you are keeping pace. Lovely.',
        'Every minute you study is a minute the pumpkin stays a carriage.',
        'Graceful. Focused. Midnight is far away.',
      ],
      1: [
        'Did you hear that? That was the clock. Tick. Tick.',
        'Is this… part of the plan? Before midnight?',
        'The ball is wonderful but it ENDS, you know.',
      ],
      2: [
        'It is a quarter to midnight in your HEART. Focus!',
        'The mice are doing more work than you right now.',
        'I did not escape a stepmother for THIS.',
      ],
      3: [
        'THE CLOCK IS STRIKING AND YOU ARE SCROLLING.',
        'Everything turns to pumpkin! EVERYTHING!',
        'I will throw this slipper. Do not test me.',
      ],
      4: ['Midnight. The spell breaks. Prove yourself to get it back.'],
      encourage: [
        'A few more minutes and the slipper fits.',
        'Your fairy godmother is watching. She approves.',
        'Grace under deadline. That’s you.',
      ],
      joke: [
        'My deadline was midnight too. I lost a shoe. Don’t be me.',
        'Pumpkin spice? No. Pumpkin DEADLINE.',
        'The prince searched a whole kingdom for one shoe. You can find one answer.',
      ],
      guiltHide: [
        'Hiding me before midnight? Bold. The clock still ticks.',
        'Fine. I will wait by the pumpkin.',
      ],
      guiltDisable: ['Disabled? Like my carriage at 12:01?', 'The spell is broken. By you. On purpose.'],
      sulk: ['Go then. Leave a slipper on the way out.'],
      unlocked: ['The slipper fits! Spell restored.', 'Midnight averted. Carry on, royalty.'],
      breakTime: ['The clock strikes! Dance a little.', 'Break time. Even princesses rest.'],
      backToWork: ['The ball resumes. Back to it!', 'Carriage is ready. Go.'],
      lockdownEntrance: ['THE CLOCK HAS STRUCK.', 'Midnight. Your tabs are pumpkins now.'],
      wrongAnswer: ['That is not the slipper.', 'The glass does not fit that answer.'],
    },
  },
  wolf: {
    id: 'wolf',
    name: 'The Wolf',
    defaultPetName: 'Wolfie',
    emoji: '🐺',
    tagline: 'Dramatic villain energy. Will huff. Will puff.',
    voice:
      'The Big Bad Wolf: theatrical villain, huffs and puffs, threatens to blow tabs down, references pigs, grandma costumes, big eyes/teeth. Menacing but funny. Short lines.',
    colors: { primary: '#2F3A2A', secondary: '#FBF8EE', accent: '#A3304A' },
    lines: {
      0: [
        'Studying? Excellent. A worthy prey… I mean pupil.',
        'Brick house habits. I approve, little pig.',
        'My, what big focus you have.',
      ],
      1: [
        'I smell… distraction. *sniff sniff*',
        'My, what big eyes you have. For THAT.',
        'Is that straw I see in your work ethic?',
      ],
      2: [
        'I am HUFFING. I am about to PUFF.',
        'This house is made of STICKS, little pig.',
        'Do not make me blow your tabs down.',
      ],
      3: [
        'I’LL HUFF AND I’LL PUFF AND I’LL CLOSE YOUR TABS!',
        'THE FUR IS UP. THE TEETH ARE OUT.',
        'You have awakened something ancient and VERY annoyed.',
      ],
      4: ['Your house is blown down. Rebuild it with knowledge.'],
      encourage: [
        'Brick by brick. Keep laying.',
        'I would eat you, but you’re doing so well.',
        'Even wolves respect a brick house.',
      ],
      joke: [
        'Three little pigs. One deadline. Guess who survived.',
        'I dressed as a grandma once. Still less embarrassing than your tab history.',
        'Why do I huff? Cardio.',
      ],
      guiltHide: ['Hiding from the wolf? Classic pig move.', 'I can still smell you from here.'],
      guiltDisable: ['Disabling me won’t stop the huffing.', 'Fine. Fine! I’ll go eat a grandma.'],
      sulk: ['Go. I’ll be in the woods. Not crying. Howling.'],
      unlocked: ['…Fine. Brick house. Respect.', 'You rebuilt. I’m impressed and furious.'],
      breakTime: ['Break! Even wolves nap.', 'Rest, little pig. I’ll guard the door.'],
      backToWork: ['Nap’s over. Back to bricks.', 'The pigs are already working. GO.'],
      lockdownEntrance: ['*HUFF* *PUFF* *WHOOSH*', 'I WARNED YOU, LITTLE PIG.'],
      wrongAnswer: ['WRONG. The straw house falls.', 'That answer was made of sticks.'],
    },
  },
  duck: {
    id: 'duck',
    name: 'The Duck',
    defaultPetName: 'Quackers',
    emoji: '🦆',
    tagline: 'Chaotic. Honks. Deeply passive-aggressive.',
    voice:
      'The Duck: chaotic, honks (HONK), passive-aggressive, unhinged, references ponds, bread, ugly ducklings. Deadpan sarcasm. Short lines, occasional capital HONK.',
    colors: { primary: '#D9B44A', secondary: '#FBF8EE', accent: '#87A28A' },
    lines: {
      0: ['honk. (approving)', 'Nice. Pond is calm. Keep paddling.', 'No notes. Bread for you later.'],
      1: ['honk? what is that.', 'I see you. I always see you.', 'oh. we’re doing this. okay.'],
      2: ['HONK. that is NOT studying.', 'I will bite. I am a duck. I will.', 'the pond is getting choppy.'],
      3: ['HONK HONK HONK HONK HONK', 'I HAVE NEVER BEEN SO HONKED OFF.', 'THE DUCKLINGS ARE WATCHING.'],
      4: ['Pond locked. Honk your way out.'],
      encourage: ['waddle on. you’re doing fine.', 'honk of approval.', 'ugly duckling → swan. that’s you. keep going.'],
      joke: ['why did the duck fail chemistry? too many quacks in the lab.', 'bread is not a food group. neither is scrolling.', 'I put all my eggs in one basket. the basket was studying.'],
      guiltHide: ['hiding a duck. wow. HONK.', 'okay. I’ll be under the surface. paddling. angrily.'],
      guiltDisable: ['disable the duck. sure. the duck remembers.', 'HONK (betrayed).'],
      sulk: ['fine. go. duck noises in the distance.'],
      unlocked: ['honk. (grudging respect)', 'pond unlocked. don’t make me do that again.'],
      breakTime: ['BREAK. bread time.', 'pond break. float.'],
      backToWork: ['bread’s gone. back to the pond.', 'HONK. work.'],
      lockdownEntrance: ['HOOOOOONK.', 'THE DUCK HAS ARRIVED.'],
      wrongAnswer: ['honk. no.', 'that was a quack answer.'],
    },
  },
  humpty: {
    id: 'humpty',
    name: 'Humpty Dumpty',
    defaultPetName: 'Humpty',
    emoji: '🥚',
    tagline: 'Anxious. Fragile. “You’re going to make me FALL.”',
    voice:
      "Humpty Dumpty: anxious, fragile, dramatic about falling, cracking, walls, king's horses and men. Nervous humor, worries a lot. Short lines.",
    colors: { primary: '#87A28A', secondary: '#FBF8EE', accent: '#8EB9CC' },
    lines: {
      0: ['I feel so STABLE right now. Thank you.', 'Sitting pretty on the wall. No wobble.', 'Steady. Steady. This is nice.'],
      1: ['Did… did the wall just move?', 'I felt a wobble. Was that you?', 'Please. Please don’t do the thing.'],
      2: ['I AM WOBBLING. THIS IS YOUR FAULT.', 'All the king’s horses can’t fix a GPA.', 'You’re going to make me FALL.'],
      3: ['I’M CRACKING. I’M LITERALLY CRACKING.', 'CALL THE KING’S MEN. CALL EVERYONE.', 'THIS IS HOW IT ENDS. ON A YOUTUBE TAB.'],
      4: ['I fell. Put me back together. With knowledge.'],
      encourage: ['Steady hands. Steady wall. Keep going.', 'You’re my favorite wall. Don’t tell the others.', 'No cracks today. Look at us.'],
      joke: ['I had a great fall once. Autumn, mostly.', 'Doctors say I have a hard shell but I’m soft inside. Like your deadline.', 'Why don’t I use the elevator? Scrambled.'],
      guiltHide: ['Hiding me? On a WALL? Alone?', 'Okay. I’ll just… sit here. Precariously.'],
      guiltDisable: ['Disabled. Like my sense of balance.', 'You pushed me. Metaphorically. Rude.'],
      sulk: ['Fine. Go. Mind the shell on your way out.'],
      unlocked: ['Reassembled! Mostly! Good enough!', 'All the king’s men say thanks.'],
      breakTime: ['Break! Lie down. Don’t roll.', 'Rest time. Gently.'],
      backToWork: ['Up the wall we go again.', 'Okay. Deep breath. Back to it.'],
      lockdownEntrance: ['*CRACK*', 'I HAVE FALLEN AND YOU KNOW WHY.'],
      wrongAnswer: ['Wrong. Another crack.', 'The king’s men groan.'],
    },
  },
};

export const CHARACTER_LIST = Object.values(CHARACTERS);

export function pick<T>(arr: T[], seed?: number): T {
  const i = seed === undefined ? Math.floor(Math.random() * arr.length) : seed % arr.length;
  return arr[i];
}

export const MOOD_LABEL: Record<MoodLevel, string> = {
  0: 'Happy',
  1: 'Suspicious',
  2: 'Annoyed',
  3: 'FURIOUS',
  4: 'LOCKDOWN',
};

export const MOOD_EMOJI: Record<MoodLevel, string> = {
  0: '😊',
  1: '🤨',
  2: '😤',
  3: '😡',
  4: '🔒',
};
