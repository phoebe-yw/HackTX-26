// Shared data model. Changing anything here is a "data model change" (Working Agreement §5).

export type CharacterId = 'red' | 'cinderella' | 'wolf' | 'duck' | 'humpty';

export type Strictness = 'gentle' | 'firm' | 'wolf';

export type WidgetSize = 'S' | 'M' | 'L';

export interface StudyMethod {
  /** Preset id, or 'custom' / 'none' */
  id: 'pomodoro' | '52-17' | 'deep' | 'custom' | 'none';
  focusMin: number;
  breakMin: number;
  longBreakMin: number;
  /** Long break every N focus blocks (0 = never) */
  longBreakEvery: number;
}

export interface Settings {
  onboarded: boolean;
  characterId: CharacterId;
  petName: string;
  topic: string;
  method: StudyMethod;
  strictness: Strictness;
  allowSites: string[];
  blockSites: string[];
  /** Opt-in: periodic screenshots of the visible tab during focus sessions. */
  screenCheckEnabled: boolean;
  widgetSize: WidgetSize;
  widgetPos: { x: number; y: number } | null;
  collapsed: boolean;
  hiddenSites: string[];
  disabled: boolean;
  demoMode: boolean;
  displayName: string;
}

export type SessionStatus = 'idle' | 'focus' | 'break' | 'longBreak';

export interface SessionState {
  status: SessionStatus;
  phaseStartedAt: number;
  phaseEndsAt: number;
  /** Number of focus blocks completed in this run */
  focusBlocksDone: number;
  /** Incremented on every phase change so widgets can animate the clock "strike" */
  strikeSeq: number;
  /** Day key (YYYY-MM-DD) for the daily total */
  dateKey: string;
  focusMsToday: number;
  /** When true the session is paused (phaseEndsAt is frozen; remainingMs is authoritative) */
  paused: boolean;
  remainingMs: number;
}

export type MoodLevel = 0 | 1 | 2 | 3 | 4; // happy, suspicious, annoyed, furious, lockdown

export type Pose =
  | 'idle'
  | 'happy'
  | 'suspicious'
  | 'annoyed'
  | 'furious'
  | 'sleeping'
  | 'celebrate';

export type SpeechKind = 'mood' | 'roast' | 'joke' | 'encourage' | 'guilt' | 'system' | 'sulk';

export interface SpeechLine {
  id: number;
  text: string;
  kind: SpeechKind;
  at: number;
  /** Which provider produced it (for the badge) */
  provider?: string;
}

export interface FocusSignal {
  at: number;
  url: string;
  title: string;
  /** null = unknown */
  onTask: boolean | null;
  source: 'allowlist' | 'blocklist' | 'classifier' | 'screen' | 'idle' | 'none';
  activity?: string;
  roastHook?: string;
  confidence?: number;
}

export interface MoodState {
  level: MoodLevel;
  /** 0..100 distraction score */
  score: number;
  lastSignal: FocusSignal | null;
  lastLine: SpeechLine | null;
  /** Whether the pet is currently "looking" (screenshot in flight) */
  looking: boolean;
  updatedAt: number;
  /** Timestamp of the last unlock, to drive the glass-slipper sparkle */
  lastUnlockAt: number;
}

export type ChallengeType = 'riddle' | 'quiz' | 'oath' | 'friend';

export interface RiddleChallenge {
  type: 'riddle';
  prompt: string;
  answers: string[];
  hint?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface QuizChallenge {
  type: 'quiz';
  questions: QuizQuestion[];
}

export interface OathChallenge {
  type: 'oath';
  text: string;
  backwards: boolean;
}

export interface FriendChallenge {
  type: 'friend';
  fromName: string;
  fromId: string;
  challengeId: string;
  prompt: string;
  answers: string[];
}

export type Challenge = RiddleChallenge | QuizChallenge | OathChallenge | FriendChallenge;

export interface LockdownState {
  active: boolean;
  startedAt: number;
  /** null while the challenge is being prepared */
  challenge: Challenge | null;
  challengeProvider?: string;
  failures: number;
  /** URL that triggered it, for the roast */
  triggerActivity?: string;
}

export interface EscapeLogEntry {
  at: number;
  reason: string;
  url: string;
}

export interface DomainCacheEntry {
  onTask: boolean;
  at: number;
  topic: string;
}

export type AiProviderId = 'gemini' | 'meta' | 'offline';

export interface AiOverrides {
  social: AiProviderId | null;
  vision: AiProviderId | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'pet' | 'system';
  text: string;
  at: number;
  provider?: string;
  withScreen?: boolean;
}
