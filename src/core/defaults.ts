import type { LockdownState, MoodState, SessionState, Settings, StudyMethod } from './types';

export const METHOD_PRESETS: Record<Exclude<StudyMethod['id'], 'custom'>, StudyMethod> = {
  pomodoro: { id: 'pomodoro', focusMin: 25, breakMin: 5, longBreakMin: 15, longBreakEvery: 4 },
  '52-17': { id: '52-17', focusMin: 52, breakMin: 17, longBreakMin: 17, longBreakEvery: 0 },
  deep: { id: 'deep', focusMin: 90, breakMin: 20, longBreakMin: 20, longBreakEvery: 0 },
  none: { id: 'none', focusMin: 0, breakMin: 0, longBreakMin: 0, longBreakEvery: 0 },
};

export const DEFAULT_ALLOW_SITES = [
  'canvas.instructure.com',
  'docs.google.com',
  'drive.google.com',
  'notion.so',
  'wikipedia.org',
  'khanacademy.org',
  'quizlet.com',
  'overleaf.com',
  'github.com',
  'stackoverflow.com',
  'chat.openai.com',
  'chatgpt.com',
  'gemini.google.com',
  'scholar.google.com',
];

export const DEFAULT_BLOCK_SITES = [
  'youtube.com',
  'instagram.com',
  'tiktok.com',
  'reddit.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'netflix.com',
  'twitch.tv',
  'discord.com',
  'pinterest.com',
  'hulu.com',
];

/** Never screenshot these (privacy). Matched as suffix on hostname. */
export const SENSITIVE_SITES = [
  'mail.google.com',
  'outlook.live.com',
  'outlook.office.com',
  'bankofamerica.com',
  'chase.com',
  'wellsfargo.com',
  'capitalone.com',
  'paypal.com',
  'venmo.com',
  '1password.com',
  'bitwarden.com',
  'lastpass.com',
  'accounts.google.com',
  'login.microsoftonline.com',
];

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  characterId: 'red',
  petName: 'Red',
  topic: '',
  method: METHOD_PRESETS.pomodoro,
  strictness: 'firm',
  allowSites: DEFAULT_ALLOW_SITES,
  blockSites: DEFAULT_BLOCK_SITES,
  screenCheckEnabled: false,
  widgetSize: 'M',
  widgetPos: null,
  collapsed: true,
  hiddenSites: [],
  disabled: false,
  demoMode: false,
  displayName: '',
};

export const DEFAULT_SESSION: SessionState = {
  status: 'idle',
  phaseStartedAt: 0,
  phaseEndsAt: 0,
  focusBlocksDone: 0,
  strikeSeq: 0,
  dateKey: '',
  focusMsToday: 0,
  paused: false,
  remainingMs: 0,
};

export const DEFAULT_MOOD: MoodState = {
  level: 0,
  score: 0,
  lastSignal: null,
  lastLine: null,
  looking: false,
  updatedAt: 0,
  lastUnlockAt: 0,
};

export const DEFAULT_LOCKDOWN: LockdownState = {
  active: false,
  startedAt: 0,
  challenge: null,
  failures: 0,
};
