// Mood state machine: distraction score 0..100 → level 0..4.
// Pure-ish helpers; the background engine owns timing and persistence.
import { CHARACTERS, pick } from '@/data/characters';
import type { CharacterId, MoodLevel, Settings, SpeechKind, SpeechLine, Strictness } from './types';
import { clamp } from './util';

/** Seconds to climb 0→100 while continuously distracted. */
const CLIMB_SECONDS: Record<Strictness, number> = { gentle: 240, firm: 120, wolf: 60 };
const DEMO_CLIMB_SECONDS = 30;
/** Recovery is faster than escalation. */
const RECOVER_FACTOR = 2;

export function climbRatePerSec(settings: Settings): number {
  const secs = settings.demoMode ? DEMO_CLIMB_SECONDS : CLIMB_SECONDS[settings.strictness];
  return 100 / secs;
}

export function levelFor(score: number): MoodLevel {
  if (score >= 100) return 4;
  if (score >= 70) return 3;
  if (score >= 45) return 2;
  if (score >= 20) return 1;
  return 0;
}

/**
 * Apply dt seconds of a signal to the score.
 * onTask: true → recover, false → climb, null → gentle drift toward 0.
 */
export function stepScore(score: number, onTask: boolean | null, dtSec: number, settings: Settings): number {
  const rate = climbRatePerSec(settings);
  if (onTask === false) return clamp(score + rate * dtSec, 0, 100);
  if (onTask === true) return clamp(score - rate * RECOVER_FACTOR * dtSec, 0, 100);
  return clamp(score - rate * 0.5 * dtSec, 0, 100);
}

let lineSeq = Date.now() % 100000;
export function makeLine(text: string, kind: SpeechKind, provider?: string): SpeechLine {
  lineSeq += 1;
  return { id: lineSeq, text, kind, at: Date.now(), provider };
}

export function moodLine(characterId: CharacterId, level: MoodLevel): string {
  return pick(CHARACTERS[characterId].lines[level]);
}

export function characterLine(
  characterId: CharacterId,
  key:
    | 'encourage'
    | 'joke'
    | 'guiltHide'
    | 'guiltDisable'
    | 'sulk'
    | 'unlocked'
    | 'breakTime'
    | 'backToWork'
    | 'lockdownEntrance'
    | 'wrongAnswer',
): string {
  return pick(CHARACTERS[characterId].lines[key]);
}
