import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { hostBlocked, nextPet, offTask, thresholds } from "./logic.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

process.env.DB_PATH = path.join(os.tmpdir(), `eggward-${Date.now()}.sqlite`);
process.env.STRIKE_SIDEEYE_SEC = "1";
process.env.STRIKE_MAD_SEC = "2";
process.env.MODEL_API_KEY = "";
process.env.GEMINI_API_KEY = "";
process.env.SERPAPI_KEY = "";

const { createApp } = await import("./app.ts");

const now = Date.now();
const { sideEye, mad } = thresholds();
assert(sideEye === 1 && mad === 2, "strike thresholds should come from the env");
const base = { mood: "fine" as const, strikes: 0, locked: false, challengeText: null, blockedSince: now - 1500 };
const side = nextPet(base, now);
assert(side.mood === "sideeye" && !side.locked, "side-eye should land before the lock");
const lockedPet = nextPet({ ...base, blockedSince: now - 2500 }, now);
assert(lockedPet.locked && lockedPet.mood === "mad" && lockedPet.challengeText === "Show me an egg.", "mad should lock with an egg challenge");
assert(hostBlocked("www.youtube.com", ["youtube.com"]), "www.youtube.com should match youtube.com");
assert(!hostBlocked("wikipedia.org", ["youtube.com"]), "wikipedia should stay allowed");
assert(offTask("news.example.com", ["youtube.com"], ["docs.google.com"]), "leaving the work site is off task");
assert(!offTask("docs.google.com", ["youtube.com"], ["docs.google.com"]), "the work site stays fine even if a blocklist exists");
assert(offTask("www.youtube.com", ["youtube.com"], []), "blocklist still counts before a work site is set");
assert(!offTask("wikipedia.org", ["youtube.com"], []), "other sites stay fine before a work site is set");

const app = await createApp();
await app.listen({ port: 0, host: "127.0.0.1" });
const address = app.server.address();
if (!address || typeof address === "string") throw new Error("no port");
const baseUrl = `http://127.0.0.1:${address.port}`;

async function api(pathname: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const data = (await response.json()) as Record<string, unknown>;
  return { response, data };
}

try {
  const health = await api("/api/health");
  assert(health.response.ok, "health check failed");

  const egg = await api("/api/rooms/EGG1/state");
  const state = egg.data.state as {
    members: Array<{ id: string; name: string; isHost: boolean }>;
    blocklist: string[];
    pets: Array<{ memberId: string; locked: boolean }>;
    messages: Array<{ body: string; kind: string }>;
  };
  assert(egg.response.ok, "seed room missing");
  const maya = state.members.find((member) => member.name === "Maya");
  const jordan = state.members.find((member) => member.name === "Jordan");
  assert(maya?.isHost, "Maya should be the host of EGG1");
  assert(jordan && state.blocklist.includes("youtube.com"), "default blocklist missing youtube");

  const again = await api("/api/rooms/EGG1/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Maya", deviceLabel: "laptop" }),
  });
  assert(again.data.memberId === maya.id, "rejoining Maya should keep the same member");

  const sam = await api("/api/rooms/EGG1/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Sam", deviceLabel: "phone" }),
  });
  assert(typeof sam.data.memberId === "string" && sam.data.memberId !== maya.id, "Sam should be a new member");

  const created = await api("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert(typeof created.data.code === "string" && created.data.code !== "EGG1", "create room should mint a code");

  const qr = await fetch(`${baseUrl}/api/rooms/EGG1/qr?target=${encodeURIComponent("http://localhost:5173/room/EGG1")}`);
  const qrBytes = new Uint8Array(await qr.arrayBuffer());
  assert(qr.ok && qr.headers.get("content-type")?.includes("image/png"), "room qr should be a png");
  assert(qrBytes[0] === 0x89 && qrBytes[1] === 0x50, "room qr should start with a png signature");
  const badQr = await fetch(`${baseUrl}/api/rooms/EGG1/qr?target=${encodeURIComponent("https://example.com/phish")}`);
  assert(badQr.status === 400, "qr should only encode this room");

  const madResponse = await api("/api/rooms/EGG1/demo-mad", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId: maya.id }),
  });
  const madState = madResponse.data.state as { pets: Array<{ memberId: string; locked: boolean; challengeText: string }> };
  assert(madState.pets.find((pet) => pet.memberId === maya.id)?.locked, "demo mad should lock Maya");

  const persisted = await api("/api/rooms/EGG1/state");
  const persistedState = persisted.data.state as { pets: Array<{ memberId: string; locked: boolean }> };
  assert(persistedState.pets.find((pet) => pet.memberId === maya.id)?.locked, "lock should survive a fresh read");

  const asked = await api("/api/rooms/EGG1/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId: jordan.id, question: "What is a hash table?" }),
  });
  const askedState = asked.data.state as { messages: Array<{ body: string }> };
  assert(askedState.messages.some((message) => message.body.includes("won't invent a citation")), "study should fail closed without SerpApi");

  const cards = await api("/api/rooms/EGG1/flashcards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId: jordan.id, url: "https://example.com" }),
  });
  const cardState = cards.data.state as { messages: Array<{ body: string }> };
  assert(cardState.messages.some((message) => message.body.includes("won't invent flashcards")), "flashcards should fail closed without SerpApi");

  const jpeg = Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBAQEBAVFhUVFRUVFRUVFRUVFRUWFxUVFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGhAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAMBAAMBIgACEQEDEQH/xAAnAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgsQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+gEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoLEQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/aAAwDAQACEQMRAD8A7+gD/9k=",
    "base64",
  );
  const form = new FormData();
  form.set("image", new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), "egg.jpg");
  const seen = await api(`/api/rooms/EGG1/see?memberId=${maya.id}`, { method: "POST", body: form });
  assert(seen.data.match === false && seen.data.reason === "missing_key", "vision should fail closed without a model key");
  const still = seen.data.state as { pets: Array<{ memberId: string; locked: boolean }> };
  assert(still.pets.find((pet) => pet.memberId === maya.id)?.locked, "a failed vision check must not unlock");

  const challenged = await api("/api/rooms/EGG1/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromMemberId: sam.data.memberId, toMemberId: jordan.id, prompt: "your shoe" }),
  });
  const challengeState = challenged.data.state as { pets: Array<{ memberId: string; locked: boolean; challengeText: string | null }> };
  assert(challengeState.pets.find((pet) => pet.memberId === jordan.id)?.challengeText === "your shoe", "challenge should target Jordan");
  assert(challengeState.pets.find((pet) => pet.memberId === sam.data.memberId)?.locked !== true, "sending a challenge should not lock the sender");

  const unlocked = await api("/api/rooms/EGG1/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId: maya.id }),
  });
  const free = unlocked.data.state as { pets: Array<{ locked: boolean }> };
  assert(free.pets.every((pet) => !pet.locked), "host override should clear every lock");

  const focused = await api("/api/rooms/EGG1/focus", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId: maya.id, goal: "turn in the essay", sites: "wikipedia.org" }),
  });
  const focusState = focused.data.state as { focus: Array<{ memberId: string; goal: string; sites: string[] }> };
  assert(focusState.focus.some((item) => item.memberId === maya.id && item.goal === "turn in the essay" && item.sites.includes("wikipedia.org")), "work focus should save");
  await api("/api/rooms/EGG1/presence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId: maya.id, hostname: "en.wikipedia.org" }),
  });
  const onTask = await api("/api/rooms/EGG1/state");
  const onTaskState = onTask.data.state as { pets: Array<{ memberId: string; locked: boolean; mood: string }> };
  assert(onTaskState.pets.find((pet) => pet.memberId === maya.id)?.mood === "fine", "the work site should keep Maya fine");
  await api("/api/rooms/EGG1/presence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId: maya.id, hostname: "example.com" }),
  });
  await sleep(3200);
  const leftWork = await api("/api/rooms/EGG1/state");
  const leftState = leftWork.data.state as { pets: Array<{ memberId: string; locked: boolean }>; messages: Array<{ body: string }> };
  assert(leftState.pets.find((pet) => pet.memberId === maya.id)?.locked, "leaving the work site should lock Maya");
  assert(leftState.messages.some((message) => message.body.includes("turn in the essay")), "the lock should name the assignment");
  await api("/api/rooms/EGG1/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId: maya.id }),
  });

  await api("/api/rooms/EGG1/presence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId: jordan.id, hostname: "www.youtube.com" }),
  });
  await sleep(3200);
  const drifted = await api("/api/rooms/EGG1/state");
  const driftState = drifted.data.state as { pets: Array<{ memberId: string; locked: boolean; mood: string }> };
  assert(driftState.pets.find((pet) => pet.memberId === jordan.id)?.locked, "YouTube should lock Jordan after the strike clock");
  assert(!driftState.pets.find((pet) => pet.memberId === maya.id)?.locked, "Maya should stay free while Jordan drifts");

  console.log("selfcheck ok");
} finally {
  await app.close();
  fs.rmSync(process.env.DB_PATH, { force: true });
}
