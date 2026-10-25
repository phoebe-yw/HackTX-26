// Clearly-fake seed data shown only when Demo Mode is on (bad venue Wi-Fi insurance).
import type { CharacterId } from '@/core/types';

export interface FriendPresence {
  uid: string;
  name: string;
  characterId: CharacterId;
  status: 'focusing' | 'break' | 'distracted' | 'offline';
  focusMsToday: number;
  topic: string;
  lastSeen: number;
  isDemo?: boolean;
}

export const DEMO_FRIENDS: FriendPresence[] = [
  { uid: 'demo-1', name: 'Priya', characterId: 'cinderella', status: 'focusing', focusMsToday: 92 * 60000, topic: 'Organic Chem ch. 7', lastSeen: Date.now(), isDemo: true },
  { uid: 'demo-2', name: 'Marcus', characterId: 'wolf', status: 'break', focusMsToday: 47 * 60000, topic: 'Linear Algebra', lastSeen: Date.now(), isDemo: true },
  { uid: 'demo-3', name: 'Jules', characterId: 'duck', status: 'distracted', focusMsToday: 15 * 60000, topic: 'Art History', lastSeen: Date.now(), isDemo: true },
  { uid: 'demo-4', name: 'Sam', characterId: 'humpty', status: 'focusing', focusMsToday: 130 * 60000, topic: 'Data Structures', lastSeen: Date.now(), isDemo: true },
];

export const DEMO_STRANGER = {
  uid: 'demo-stranger',
  name: 'Mysterious Stranger',
  characterId: 'wolf' as CharacterId,
  topic: 'Medieval Literature',
};
