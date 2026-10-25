import type { CharacterId } from '@/core/types';

export type PresenceStatus = 'focusing' | 'break' | 'distracted' | 'offline';

export interface Me {
  uid: string;
  name: string;
  code: string;
  characterId: CharacterId;
  /** 'firebase' when connected to Firestore, 'local' when running offline/demo */
  mode: 'firebase' | 'local';
  ready: boolean;
  error?: string;
}

export interface Friend {
  uid: string;
  name: string;
  code?: string;
  characterId: CharacterId;
  status: PresenceStatus;
  focusMsToday: number;
  topic: string;
  lastSeen: number;
  isDemo?: boolean;
}

export interface FriendRequest {
  id: string;
  from: string;
  fromName: string;
  fromCharacter: CharacterId;
  at: number;
}

export interface Nudge {
  id: string;
  fromName: string;
  at: number;
}

export interface RoomMember {
  uid: string;
  name: string;
  characterId: CharacterId;
}
export interface RoomMessage {
  id: string;
  uid: string;
  name: string;
  text: string;
  isAI?: boolean;
  provider?: string;
  at: number;
}
export interface Flashcard {
  front: string;
  back: string;
}
export interface RoomState {
  id: string;
  code: string;
  topic: string;
  hostUid: string;
  members: RoomMember[];
  messages: RoomMessage[];
  flashcards: Flashcard[];
  flashcardsProvider?: string;
  quiz: { question: string; options: string[]; correctIndex: number }[];
  quizProvider?: string;
  aiBusy?: boolean;
}

export type Mark = 'g' | 'y' | 'x';
export interface Guess {
  word: string;
  marks: Mark[];
}
export interface GamePlayer {
  uid: string;
  name: string;
  characterId: CharacterId;
  guesses: Guess[];
  solvedAt: number | null;
  failed?: boolean;
  isBot?: boolean;
}
export interface GameChat {
  id: string;
  uid: string;
  name: string;
  text: string;
  at: number;
}
export interface GameState {
  id: string;
  word: string;
  players: GamePlayer[];
  status: 'playing' | 'finished';
  winnerUid: string | null;
  startedAt: number;
  icebreaker?: string;
  icebreakerProvider?: string;
  chat: GameChat[];
  /** uid of the other player (friend or stranger) */
  opponentUid: string;
  opponentIsFriend: boolean;
}

export interface QueueState {
  status: 'idle' | 'waiting' | 'matched' | 'error';
  since: number;
  message?: string;
}

export interface GameInvite {
  id: string;
  fromUid: string;
  fromName: string;
  gameId: string;
  at: number;
}

/** chrome.storage.session keys mirrored by the offscreen document */
export const SK = {
  me: 'social.me',
  friends: 'social.friends',
  requests: 'social.requests',
  nudges: 'social.nudges',
  room: 'social.room',
  game: 'social.game',
  queue: 'social.queue',
  invites: 'social.invites',
} as const;

/** Commands the UI can send to the social backend (handled in the offscreen doc). */
export type SocialCmd =
  | { cmd: 'ping' }
  | { cmd: 'setName'; name: string }
  | { cmd: 'addFriendByCode'; code: string }
  | { cmd: 'respondRequest'; id: string; accept: boolean }
  | { cmd: 'removeFriend'; uid: string }
  | { cmd: 'nudge'; uid: string }
  | { cmd: 'sendChallenge'; uid: string; prompt?: string; answers?: string[]; generate?: boolean }
  | { cmd: 'dismissNudge'; id: string }
  // rooms
  | { cmd: 'createRoom' }
  | { cmd: 'joinRoom'; code: string }
  | { cmd: 'leaveRoom' }
  | { cmd: 'roomMessage'; text: string }
  | { cmd: 'roomFlashcards'; notes?: string }
  | { cmd: 'roomQuiz' }
  // tavern
  | { cmd: 'findStranger' }
  | { cmd: 'cancelFind' }
  | { cmd: 'inviteFriendToGame'; uid: string }
  | { cmd: 'acceptInvite'; id: string }
  | { cmd: 'guess'; word: string }
  | { cmd: 'gameChat'; text: string }
  | { cmd: 'leaveGame' }
  | { cmd: 'addFriendFromGame' };
