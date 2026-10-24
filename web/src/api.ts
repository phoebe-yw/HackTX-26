import type { RoomState } from "./types";

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, { ...init, headers });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string; line?: string };
  if (!response.ok) throw new Error(data.line || data.error || `Request failed (${response.status})`);
  return data;
}

export function getState(code: string) {
  return request<{ state: RoomState }>(`/api/rooms/${code}/state`);
}

export function createRoom() {
  return request<{ code: string; state: RoomState }>("/api/rooms", { method: "POST", body: "{}" });
}

export function joinRoom(code: string, name: string, deviceLabel: string) {
  return request<{ memberId: string; state: RoomState }>(`/api/rooms/${code}/join`, {
    method: "POST",
    body: JSON.stringify({ name, deviceLabel }),
  });
}

export function ask(code: string, memberId: string, question: string) {
  return request<{ state: RoomState }>(`/api/rooms/${code}/ask`, {
    method: "POST",
    body: JSON.stringify({ memberId, question }),
  });
}

export function flashcards(code: string, memberId: string, url: string) {
  return request<{ state: RoomState }>(`/api/rooms/${code}/flashcards`, {
    method: "POST",
    body: JSON.stringify({ memberId, url }),
  });
}

export function challenge(code: string, fromMemberId: string, toMemberId: string, prompt: string) {
  return request<{ state: RoomState }>(`/api/rooms/${code}/challenge`, {
    method: "POST",
    body: JSON.stringify({ fromMemberId, toMemberId, prompt }),
  });
}

export function demoMad(code: string, memberId: string) {
  return request<{ state: RoomState }>(`/api/rooms/${code}/demo-mad`, {
    method: "POST",
    body: JSON.stringify({ memberId }),
  });
}

export function unlock(code: string, memberId: string) {
  return request<{ state: RoomState }>(`/api/rooms/${code}/unlock`, {
    method: "POST",
    body: JSON.stringify({ memberId }),
  });
}

export function setFocus(code: string, memberId: string, goal: string, sites: string) {
  return request<{ state: RoomState }>(`/api/rooms/${code}/focus`, {
    method: "POST",
    body: JSON.stringify({ memberId, goal, sites }),
  });
}

export function addDomain(code: string, domain: string) {
  return request<{ state: RoomState }>(`/api/rooms/${code}/domains`, {
    method: "POST",
    body: JSON.stringify({ domain }),
  });
}

export function see(code: string, memberId: string, image: Blob) {
  const form = new FormData();
  form.set("image", image, "challenge.jpg");
  return request<{ match: boolean; line: string; reason: string; state: RoomState }>(
    `/api/rooms/${code}/see?memberId=${encodeURIComponent(memberId)}`,
    { method: "POST", body: form },
  );
}
