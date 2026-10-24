const steps = ["you", "look", "room", "home"];
const nameInput = document.querySelector("#name");
const roomInput = document.querySelector("#room");
const serverInput = document.querySelector("#server");
const appInput = document.querySelector("#app");
const serverHome = document.querySelector("#server-home");
const appHome = document.querySelector("#app-home");

let draftLook = eggwardLook(null);
let busy = false;

function setBusy(next) {
  busy = next;
  document.querySelectorAll("button").forEach((button) => {
    button.disabled = next;
  });
}

async function settings() {
  const stored = await chrome.storage.local.get([
    "serverUrl",
    "appUrl",
    "roomCode",
    "memberId",
    "memberName",
    "look",
    "lookChosen",
    "petHidden",
  ]);
  return {
    serverUrl: stored.serverUrl || "http://localhost:3000",
    appUrl: stored.appUrl || "http://localhost:5173",
    roomCode: stored.roomCode || "",
    memberId: stored.memberId || "",
    memberName: stored.memberName || "",
    look: eggwardLook(stored.look),
    lookChosen: Boolean(stored.lookChosen),
    petHidden: Boolean(stored.petHidden),
  };
}

function show(step) {
  for (const name of steps) {
    document.querySelector(`#step-${name}`).classList.toggle("hidden", name !== step);
  }
  document.querySelector("#steps").classList.toggle("hidden", step === "home");
  document.querySelectorAll("#steps span").forEach((dot) => {
    dot.classList.toggle("on", dot.dataset.step === step);
  });
}

function lookActions(editing) {
  document.querySelector("#to-room").textContent = editing ? "Done" : "Continue";
  document.querySelector("#look-back").textContent = editing ? "Cancel" : "Back";
}

function paintPreview() {
  const svg = eggwardSvg("fine", draftLook);
  for (const id of ["preview-you", "preview-look", "preview-room"]) {
    document.querySelector(`#${id}`).innerHTML = svg;
  }
  document.querySelectorAll("[data-shell]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.shell === draftLook.shell);
  });
  document.querySelectorAll("[data-accessory]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.accessory === draftLook.accessory);
  });
}

function fillConnection(cfg) {
  serverInput.value = cfg.serverUrl;
  appInput.value = cfg.appUrl;
  serverHome.value = cfg.serverUrl;
  appHome.value = cfg.appUrl;
  if (!nameInput.value) nameInput.value = cfg.memberName;
  if (!roomInput.value && cfg.roomCode) roomInput.value = cfg.roomCode;
}

async function saveConnection(serverValue, appValue) {
  await chrome.storage.local.set({
    serverUrl: serverValue.trim() || "http://localhost:3000",
    appUrl: appValue.trim() || "http://localhost:5173",
  });
}

async function enterRoom(code, name) {
  const cfg = await settings();
  const response = await fetch(`${cfg.serverUrl}/api/rooms/${code}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, deviceLabel: "extension" }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.memberId) throw new Error("That room code does not exist.");
  await chrome.storage.local.set({
    roomCode: code,
    memberId: data.memberId,
    memberName: name,
    lookChosen: true,
    look: draftLook,
  });
}

function showPhrase(challenge) {
  const text = (challenge || "Show me an egg.").trim();
  if (/egg/i.test(text)) return "an egg";
  const stripped = text.replace(/^show me\s+(an?\s+|the\s+)?/i, "");
  return stripped || "an egg";
}

async function refreshHome() {
  const cfg = await settings();
  fillConnection(cfg);
  draftLook = cfg.look;
  document.querySelector("#code").textContent = cfg.roomCode || "—";
  document.querySelector("#preview-home").innerHTML = eggwardSvg("fine", cfg.look);
  document.querySelector("#visibility").textContent = cfg.petHidden ? "Show buddy" : "Hide buddy";
  const link = `${cfg.appUrl.replace(/\/$/, "")}/room/${cfg.roomCode}`;
  document.querySelector("#link").textContent = link;
  document.querySelector("#qr").src = `${cfg.serverUrl}/api/rooms/${encodeURIComponent(cfg.roomCode)}/qr?target=${encodeURIComponent(link)}`;
  const unlock = document.querySelector("#unlock");
  try {
    const response = await fetch(`${cfg.serverUrl}/api/rooms/${cfg.roomCode}/state`);
    const data = await response.json();
    if (!response.ok || !data.state) throw new Error("missing");
    const state = data.state;
    const me = state.members.find((member) => member.id === cfg.memberId);
    const pet = state.pets.find((item) => item.memberId === cfg.memberId);
    const mood = pet?.locked ? "MAD" : pet?.mood === "sideeye" ? "side-eye" : "fine";
    document.querySelector("#preview-home").innerHTML = eggwardSvg(pet?.locked ? "mad" : pet?.mood, cfg.look);
    document.querySelector("#home-kicker").textContent = me?.isHost ? "Your room · host" : "Your room";
    const locked = state.pets
      .filter((item) => item.locked)
      .map((item) => {
        const person = state.members.find((member) => member.id === item.memberId)?.name ?? "Someone";
        return `${person} is locked until they show ${showPhrase(item.challengeText)}.`;
      });
    document.querySelector("#status").textContent = locked.length
      ? locked.join(" ")
      : `${me?.name ?? cfg.memberName} · ${mood}`;
    document.querySelector("#blocked").textContent = `Blocked: ${state.blocklist.join(", ")}`;
    const focus = (state.focus || []).find((item) => item.memberId === cfg.memberId);
    const goalInput = document.querySelector("#goal");
    const sitesInput = document.querySelector("#sites");
    if (document.activeElement !== goalInput) goalInput.value = focus?.goal || "";
    if (document.activeElement !== sitesInput) sitesInput.value = (focus?.sites || []).join(", ");
    document.querySelector("#focus-status").textContent = focus?.sites?.length
      ? `Leave ${focus.sites.join(", ")} and I get mad.`
      : "Set the sites for this assignment. Until then, only the block list counts.";
    unlock.classList.toggle("hidden", state.room.hostMemberId !== cfg.memberId);
    document.querySelector("#home-error").textContent = "";
  } catch {
    document.querySelector("#status").textContent = "Can't reach the API. Is the server running?";
    unlock.classList.add("hidden");
  }
}

async function boot() {
  const cfg = await settings();
  draftLook = cfg.look;
  fillConnection(cfg);
  paintPreview();
  if (cfg.memberId && cfg.roomCode) {
    show("home");
    await refreshHome();
    return;
  }
  if (!cfg.memberName) {
    show("you");
    return;
  }
  if (!cfg.lookChosen) {
    lookActions(false);
    show("look");
    return;
  }
  show("room");
}

document.querySelector("#to-look").addEventListener("click", async () => {
  const name = nameInput.value.trim();
  const error = document.querySelector("#you-error");
  if (!name) {
    error.textContent = "I need a name, even a fake one.";
    return;
  }
  error.textContent = "";
  await chrome.storage.local.set({ memberName: name });
  lookActions(false);
  show("look");
});

document.querySelector("#shells").addEventListener("click", (event) => {
  const button = event.target.closest("[data-shell]");
  if (!button) return;
  draftLook = { ...draftLook, shell: button.dataset.shell };
  paintPreview();
});

document.querySelector("#accessories").addEventListener("click", (event) => {
  const button = event.target.closest("[data-accessory]");
  if (!button) return;
  draftLook = { ...draftLook, accessory: button.dataset.accessory };
  paintPreview();
});

document.querySelector("#look-back").addEventListener("click", async () => {
  const cfg = await settings();
  if (cfg.memberId && cfg.roomCode) {
    draftLook = cfg.look;
    paintPreview();
    show("home");
    return;
  }
  show("you");
});

document.querySelector("#to-room").addEventListener("click", async () => {
  await chrome.storage.local.set({ look: draftLook, lookChosen: true });
  const cfg = await settings();
  if (cfg.memberId && cfg.roomCode) {
    show("home");
    await refreshHome();
    return;
  }
  show("room");
});

document.querySelector("#create").addEventListener("click", async () => {
  const error = document.querySelector("#room-error");
  error.textContent = "";
  setBusy(true);
  try {
    await saveConnection(serverInput.value, appInput.value);
    const cfg = await settings();
    const response = await fetch(`${cfg.serverUrl}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.code) throw new Error("Could not create a room");
    await enterRoom(data.code, cfg.memberName || nameInput.value.trim());
    show("home");
    await refreshHome();
  } catch (err) {
    error.textContent = err instanceof TypeError ? "Can't reach the API. Is the server running?" : err instanceof Error ? err.message : "Could not create a room";
  } finally {
    setBusy(false);
  }
});

document.querySelector("#join-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = document.querySelector("#room-error");
  const code = roomInput.value.trim().toUpperCase();
  if (!code) {
    error.textContent = "Type the room code first.";
    return;
  }
  error.textContent = "";
  setBusy(true);
  try {
    await saveConnection(serverInput.value, appInput.value);
    const cfg = await settings();
    await enterRoom(code, cfg.memberName || nameInput.value.trim());
    show("home");
    await refreshHome();
  } catch (err) {
    error.textContent = err instanceof TypeError ? "Can't reach the API. Is the server running?" : err instanceof Error ? err.message : "Could not join that room";
  } finally {
    setBusy(false);
  }
});

document.querySelector("#visibility").addEventListener("click", async () => {
  const cfg = await settings();
  await chrome.storage.local.set({ petHidden: !cfg.petHidden });
  await refreshHome();
});

document.querySelector("#mad").addEventListener("click", async () => {
  const cfg = await settings();
  if (!cfg.memberId) return;
  setBusy(true);
  try {
    await fetch(`${cfg.serverUrl}/api/rooms/${cfg.roomCode}/demo-mad`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: cfg.memberId }),
    });
    await refreshHome();
  } finally {
    setBusy(false);
  }
});

document.querySelector("#canvas").addEventListener("click", () => {
  const input = document.querySelector("#sites");
  if (!input.value.includes("instructure.com")) {
    input.value = input.value.trim() ? `${input.value.trim()}, instructure.com` : "instructure.com";
  }
});

document.querySelector("#focus-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const cfg = await settings();
  const response = await fetch(`${cfg.serverUrl}/api/rooms/${cfg.roomCode}/focus`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      memberId: cfg.memberId,
      goal: document.querySelector("#goal").value,
      sites: document.querySelector("#sites").value,
    }),
  });
  const data = await response.json().catch(() => ({}));
  document.querySelector("#home-error").textContent = response.ok ? "" : data.error === "bad_domain" ? "That site looks wrong." : "Could not save that.";
  if (response.ok) await refreshHome();
});

document.querySelector("#block-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const domain = document.querySelector("#domain");
  const value = domain.value.trim();
  if (!value) return;
  const cfg = await settings();
  const response = await fetch(`${cfg.serverUrl}/api/rooms/${cfg.roomCode}/domains`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain: value }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    document.querySelector("#home-error").textContent = data.error === "bad_domain" ? "That domain looks wrong." : "Could not block that.";
    return;
  }
  domain.value = "";
  document.querySelector("#home-error").textContent = "";
  await refreshHome();
});

document.querySelector("#open").addEventListener("click", async () => {
  const cfg = await settings();
  chrome.tabs.create({ url: `${cfg.appUrl.replace(/\/$/, "")}/room/${cfg.roomCode}` });
});

document.querySelector("#retouch").addEventListener("click", () => {
  lookActions(true);
  paintPreview();
  show("look");
});

document.querySelector("#unlock").addEventListener("click", async () => {
  const cfg = await settings();
  setBusy(true);
  try {
    await fetch(`${cfg.serverUrl}/api/rooms/${cfg.roomCode}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: cfg.memberId }),
    });
    await refreshHome();
  } finally {
    setBusy(false);
  }
});

document.querySelector("#leave").addEventListener("click", async () => {
  await chrome.storage.local.set({ memberId: "", roomCode: "" });
  show("room");
  paintPreview();
});

document.querySelector("#save-connection").addEventListener("click", async () => {
  await saveConnection(serverHome.value, appHome.value);
  await refreshHome();
});

boot();
