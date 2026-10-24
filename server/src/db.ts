import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  DEFAULT_BLOCKLIST,
  makeCode,
  moodChanged,
  nextPet,
  normalizeDomain,
  withPresence,
  type Mood,
  type PetSnapshot,
} from "./logic.ts";

export type Source = { title: string; link: string; snippet: string };
export type Card = { q: string; a: string };

export type Member = {
  id: string;
  name: string;
  deviceLabel: string;
  isHost: boolean;
};

export type Pet = PetSnapshot & { memberId: string };

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

type RoomRow = { id: string; code: string; host_member_id: string | null };
type MemberRow = { id: string; room_id: string; name: string; device_label: string };
type PetRow = {
  member_id: string;
  room_id: string;
  name: string;
  code: string;
  mood: Mood;
  strikes: number;
  locked: number;
  challenge_text: string | null;
  blocked_since: number | null;
};

let db: DatabaseSync | null = null;

function database() {
  if (!db) throw new Error("database_closed");
  return db;
}

export function openDb(file = process.env.DB_PATH || path.resolve(process.cwd(), "data", "eggward.sqlite")) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      host_member_id TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      name TEXT NOT NULL,
      device_label TEXT NOT NULL,
      last_seen INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pets (
      member_id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      mood TEXT NOT NULL,
      strikes INTEGER NOT NULL,
      locked INTEGER NOT NULL,
      challenge_text TEXT,
      blocked_since INTEGER,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      author TEXT NOT NULL,
      kind TEXT NOT NULL,
      body TEXT NOT NULL,
      payload_json TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS blocklist (
      room_id TEXT NOT NULL,
      domain TEXT NOT NULL,
      PRIMARY KEY (room_id, domain)
    );
    CREATE TABLE IF NOT EXISTS focus (
      member_id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      goal TEXT NOT NULL,
      sites_json TEXT NOT NULL
    );
  `);
  seed();
}

export function closeDb() {
  db?.close();
  db = null;
}

function seed() {
  const existing = database().prepare("SELECT id FROM rooms WHERE code = ?").get("EGG1") as { id: string } | undefined;
  if (existing) return;
  const roomId = crypto.randomUUID();
  const maya = crypto.randomUUID();
  const jordan = crypto.randomUUID();
  const now = Date.now();
  const connection = database();
  connection.exec("BEGIN");
  try {
    connection.prepare("INSERT INTO rooms (id, code, host_member_id, created_at) VALUES (?, ?, ?, ?)").run(roomId, "EGG1", maya, now);
    insertMember(roomId, maya, "Maya", "laptop", now);
    insertMember(roomId, jordan, "Jordan", "laptop", now);
    for (const domain of DEFAULT_BLOCKLIST) {
      connection.prepare("INSERT INTO blocklist (room_id, domain) VALUES (?, ?)").run(roomId, domain);
    }
    connection.prepare(
      "INSERT INTO messages (id, room_id, author, kind, body, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(crypto.randomUUID(), roomId, "Eggward", "system", "Room EGG1 is open. I already distrust YouTube.", null, now);
    connection.exec("COMMIT");
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
}

function insertMember(roomId: string, id: string, name: string, device: string, now: number) {
  database().prepare("INSERT INTO members (id, room_id, name, device_label, last_seen) VALUES (?, ?, ?, ?, ?)").run(id, roomId, name, device, now);
  database().prepare(
    "INSERT INTO pets (member_id, room_id, mood, strikes, locked, challenge_text, blocked_since, updated_at) VALUES (?, ?, 'fine', 0, 0, NULL, NULL, ?)",
  ).run(id, roomId, now);
}

function roomByCode(code: string) {
  return database().prepare("SELECT id, code, host_member_id FROM rooms WHERE code = ?").get(code.toUpperCase()) as RoomRow | undefined;
}

function snapshot(row: { mood: Mood; strikes: number; locked: number; challenge_text: string | null; blocked_since: number | null }): PetSnapshot {
  return {
    mood: row.mood,
    strikes: row.strikes,
    locked: row.locked === 1,
    challengeText: row.challenge_text,
    blockedSince: row.blocked_since,
  };
}

function savePet(memberId: string, pet: PetSnapshot) {
  database().prepare(
    "UPDATE pets SET mood = ?, strikes = ?, locked = ?, challenge_text = ?, blocked_since = ?, updated_at = ? WHERE member_id = ?",
  ).run(pet.mood, pet.strikes, pet.locked ? 1 : 0, pet.challengeText, pet.blockedSince, Date.now(), memberId);
}

export function readState(code: string, flags: { modelConfigured: boolean; searchConfigured: boolean }): RoomState | null {
  const room = roomByCode(code);
  if (!room) return null;
  const members = database().prepare("SELECT id, room_id, name, device_label FROM members WHERE room_id = ? ORDER BY name").all(room.id) as MemberRow[];
  const pets = database().prepare("SELECT member_id, mood, strikes, locked, challenge_text, blocked_since FROM pets WHERE room_id = ?").all(room.id) as Array<{
    member_id: string;
    mood: Mood;
    strikes: number;
    locked: number;
    challenge_text: string | null;
    blocked_since: number | null;
  }>;
  const messages = database().prepare(
    "SELECT id, author, kind, body, payload_json, created_at FROM messages WHERE room_id = ? ORDER BY created_at DESC LIMIT 50",
  ).all(room.id) as Array<{
    id: string;
    author: string;
    kind: ChatMessage["kind"];
    body: string;
    payload_json: string | null;
    created_at: number;
  }>;
  const domains = database().prepare("SELECT domain FROM blocklist WHERE room_id = ? ORDER BY domain").all(room.id) as Array<{ domain: string }>;
  const focusRows = database().prepare("SELECT member_id, goal, sites_json FROM focus WHERE room_id = ?").all(room.id) as Array<{
    member_id: string;
    goal: string;
    sites_json: string;
  }>;
  return {
    room: { code: room.code, hostMemberId: room.host_member_id ?? "" },
    members: members.map((member) => ({
      id: member.id,
      name: member.name,
      deviceLabel: member.device_label,
      isHost: member.id === room.host_member_id,
    })),
    pets: pets.map((pet) => ({ memberId: pet.member_id, ...snapshot(pet) })),
    messages: messages.reverse().map((message) => {
      const payload = message.payload_json ? (JSON.parse(message.payload_json) as { sources?: Source[]; cards?: Card[] }) : null;
      return {
        id: message.id,
        author: message.author,
        kind: message.kind,
        body: message.body,
        sources: payload?.sources ?? null,
        cards: payload?.cards ?? null,
        createdAt: message.created_at,
      };
    }),
    blocklist: domains.map((row) => row.domain),
    focus: focusRows.map((row) => ({
      memberId: row.member_id,
      goal: row.goal,
      sites: JSON.parse(row.sites_json) as string[],
    })),
    modelConfigured: flags.modelConfigured,
    searchConfigured: flags.searchConfigured,
  };
}

export function createRoom() {
  const now = Date.now();
  let code = makeCode();
  while (roomByCode(code)) code = makeCode();
  const id = crypto.randomUUID();
  database().prepare("INSERT INTO rooms (id, code, host_member_id, created_at) VALUES (?, ?, NULL, ?)").run(id, code, now);
  const insert = database().prepare("INSERT INTO blocklist (room_id, domain) VALUES (?, ?)");
  for (const domain of DEFAULT_BLOCKLIST) insert.run(id, domain);
  return code;
}

export function joinRoom(code: string, name: string, deviceLabel: string) {
  const room = roomByCode(code);
  if (!room) return null;
  const clean = name.trim().slice(0, 24);
  if (!clean) return null;
  const device = (deviceLabel || "browser").trim().slice(0, 32) || "browser";
  const now = Date.now();
  const existing = database().prepare("SELECT id FROM members WHERE room_id = ? AND lower(name) = lower(?)").get(room.id, clean) as { id: string } | undefined;
  if (existing) {
    database().prepare("UPDATE members SET device_label = ?, last_seen = ? WHERE id = ?").run(device, now, existing.id);
    return existing.id;
  }
  const id = crypto.randomUUID();
  insertMember(room.id, id, clean, device, now);
  if (!room.host_member_id) {
    database().prepare("UPDATE rooms SET host_member_id = ? WHERE id = ?").run(id, room.id);
  }
  addMessage(room.id, "Eggward", "system", `${clean} sat down. Be cool.`, null);
  return id;
}

function memberInRoom(code: string, memberId: string) {
  const room = roomByCode(code);
  if (!room) return null;
  const member = database().prepare("SELECT id, room_id, name, device_label FROM members WHERE id = ? AND room_id = ?").get(memberId, room.id) as MemberRow | undefined;
  if (!member) return null;
  return { room, member };
}

function domainsFor(roomId: string) {
  return (database().prepare("SELECT domain FROM blocklist WHERE room_id = ?").all(roomId) as Array<{ domain: string }>).map((row) => row.domain);
}

function loadPet(memberId: string) {
  return database().prepare("SELECT mood, strikes, locked, challenge_text, blocked_since FROM pets WHERE member_id = ?").get(memberId) as
    | { mood: Mood; strikes: number; locked: number; challenge_text: string | null; blocked_since: number | null }
    | undefined;
}

export function setPresence(code: string, memberId: string, hostname: string) {
  const found = memberInRoom(code, memberId);
  const row = found ? loadPet(memberId) : undefined;
  if (!found || !row) return false;
  const before = snapshot(row);
  const after = withPresence(before, hostname, domainsFor(found.room.id), Date.now(), focusSites(memberId));
  savePet(memberId, after);
  if (!before.locked && after.locked) {
    addMessage(found.room.id, "Eggward", "system", driftLine(found.member.name, memberId), null);
  }
  return moodChanged(before, after);
}

export function evaluateRoom(code: string) {
  const room = roomByCode(code);
  if (!room) return false;
  const rows = database().prepare(
    `SELECT pets.member_id, pets.mood, pets.strikes, pets.locked, pets.challenge_text, pets.blocked_since, members.name
     FROM pets JOIN members ON members.id = pets.member_id
     WHERE pets.room_id = ? AND pets.locked = 0 AND pets.blocked_since IS NOT NULL`,
  ).all(room.id) as Array<{
    member_id: string;
    mood: Mood;
    strikes: number;
    locked: number;
    challenge_text: string | null;
    blocked_since: number | null;
    name: string;
  }>;
  let changed = false;
  const now = Date.now();
  for (const row of rows) {
    const before = snapshot(row);
    const after = nextPet(before, now);
    if (
      before.mood === after.mood &&
      before.strikes === after.strikes &&
      before.locked === after.locked &&
      before.blockedSince === after.blockedSince &&
      before.challengeText === after.challengeText
    ) {
      continue;
    }
    savePet(row.member_id, after);
    if (moodChanged(before, after)) changed = true;
    if (!before.locked && after.locked) {
      addMessage(room.id, "Eggward", "system", driftLine(row.name, row.member_id), null);
    }
  }
  return changed;
}

export function demoMad(code: string, memberId: string) {
  const found = memberInRoom(code, memberId);
  if (!found) return false;
  savePet(memberId, {
    mood: "mad",
    strikes: 45,
    locked: true,
    challengeText: "Show me an egg.",
    blockedSince: null,
  });
  addMessage(found.room.id, "Eggward", "system", `${found.member.name} asked for it. Locked until they show an egg.`, null);
  return true;
}

function focusSites(memberId: string) {
  const row = database().prepare("SELECT sites_json FROM focus WHERE member_id = ?").get(memberId) as { sites_json: string } | undefined;
  if (!row) return [];
  const sites = JSON.parse(row.sites_json) as string[];
  return Array.isArray(sites) ? sites : [];
}

function driftLine(name: string, memberId: string) {
  const row = database().prepare("SELECT goal FROM focus WHERE member_id = ?").get(memberId) as { goal: string } | undefined;
  if (row?.goal) return `${name} left "${row.goal}". Locked until they show an egg.`;
  if (focusSites(memberId).length > 0) return `${name} left their work site. Locked until they show an egg.`;
  return `${name} drifted. Locked until they show an egg.`;
}

export function setFocus(code: string, memberId: string, goal: string, sitesInput: string) {
  const found = memberInRoom(code, memberId);
  if (!found) return { error: "missing_member" as const };
  const sites: string[] = [];
  for (const part of sitesInput.split(/[\s,]+/)) {
    if (!part.trim()) continue;
    const domain = normalizeDomain(part);
    if (!domain) return { error: "bad_domain" as const };
    if (!sites.includes(domain)) sites.push(domain);
    if (sites.length >= 6) break;
  }
  const cleanGoal = goal.trim().slice(0, 80);
  if (sites.length === 0) {
    database().prepare("DELETE FROM focus WHERE member_id = ?").run(memberId);
    return { error: null };
  }
  database().prepare(
    `INSERT INTO focus (member_id, room_id, goal, sites_json) VALUES (?, ?, ?, ?)
     ON CONFLICT(member_id) DO UPDATE SET room_id = excluded.room_id, goal = excluded.goal, sites_json = excluded.sites_json`,
  ).run(memberId, found.room.id, cleanGoal, JSON.stringify(sites));
  const label = cleanGoal || sites.join(", ");
  addMessage(found.room.id, "Eggward", "system", `${found.member.name} is working on ${label}. Other sites count as drifting.`, null);
  return { error: null };
}

export function addDomain(code: string, domainInput: string) {
  const room = roomByCode(code);
  if (!room) return { error: "missing_room" as const };
  const domain = normalizeDomain(domainInput);
  if (!domain) return { error: "bad_domain" as const };
  database().prepare("INSERT OR IGNORE INTO blocklist (room_id, domain) VALUES (?, ?)").run(room.id, domain);
  return { error: null };
}

export function sendChallenge(code: string, fromId: string, toId: string, prompt: string) {
  const from = memberInRoom(code, fromId);
  const to = memberInRoom(code, toId);
  if (!from || !to) return false;
  const text = (prompt.trim() || "Show me an egg.").slice(0, 80);
  savePet(toId, {
    mood: "mad",
    strikes: 45,
    locked: true,
    challengeText: text,
    blockedSince: null,
  });
  addMessage(from.room.id, "Eggward", "system", `${from.member.name} locked ${to.member.name} until they show: ${text}`, null);
  return true;
}

export function unlockMember(code: string, memberId: string, line: string) {
  const found = memberInRoom(code, memberId);
  if (!found) return false;
  savePet(memberId, { mood: "fine", strikes: 0, locked: false, challengeText: null, blockedSince: null });
  addMessage(found.room.id, "Eggward", "system", line, null);
  return true;
}

export function unlockRoom(code: string, hostMemberId: string) {
  const room = roomByCode(code);
  if (!room) return { error: "missing_room" as const };
  if (room.host_member_id !== hostMemberId) return { error: "not_host" as const };
  const locked = database().prepare("SELECT member_id FROM pets WHERE room_id = ? AND locked = 1").all(room.id) as Array<{ member_id: string }>;
  for (const pet of locked) {
    const member = database().prepare("SELECT name FROM members WHERE id = ?").get(pet.member_id) as { name: string };
    unlockMember(code, pet.member_id, `Host override. ${member.name} is free. This time.`);
  }
  if (locked.length === 0) addMessage(room.id, "Eggward", "system", "Host override. Nobody was locked, but noted.", null);
  return { error: null };
}

export function addMessage(
  roomId: string,
  author: string,
  kind: ChatMessage["kind"],
  body: string,
  payload: { sources?: Source[]; cards?: Card[] } | null,
) {
  database().prepare(
    "INSERT INTO messages (id, room_id, author, kind, body, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(crypto.randomUUID(), roomId, author, kind, body, payload ? JSON.stringify(payload) : null, Date.now());
}

export function requireMember(code: string, memberId: string) {
  return memberInRoom(code, memberId);
}

export function petFor(memberId: string) {
  const row = loadPet(memberId);
  return row ? snapshot(row) : null;
}

export function listRoomCodes() {
  return (database().prepare("SELECT code FROM rooms").all() as Array<{ code: string }>).map((row) => row.code);
}
