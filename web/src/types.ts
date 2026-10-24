export type Mood = "fine" | "sideeye" | "mad";

export type Member = {
  id: string;
  name: string;
  deviceLabel: string;
  isHost: boolean;
};

export type Pet = {
  memberId: string;
  mood: Mood;
  strikes: number;
  locked: boolean;
  challengeText: string | null;
  blockedSince: number | null;
};

export type Source = { title: string; link: string; snippet: string };
export type Card = { q: string; a: string };

export type ChatMessage = {
  id: string;
  author: string;
  kind: "chat" | "system" | "answer" | "flashcard";
  body: string;
  sources: Source[] | null;
  cards: Card[] | null;
  createdAt: number;
};

export type RoomState = {
  room: { code: string; hostMemberId: string };
  members: Member[];
  pets: Pet[];
  messages: ChatMessage[];
  blocklist: string[];
  focus: Array<{ memberId: string; goal: string; sites: string[] }>;
  modelConfigured: boolean;
  searchConfigured: boolean;
};
