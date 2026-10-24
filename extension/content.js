const LINES = {
  fine: [
    "I'm here. Unfortunately, so is your homework.",
    "Tiny progress still counts. I checked.",
    "We can do one ugly page. Then we negotiate.",
    "I brought snacks. The snack is pressure.",
    "One paragraph. I will time you. I will not.",
    "Your notes called. They miss you.",
    "I am a pet, not a productivity system. Act surprised.",
    "Keep the tab that pays rent in your future.",
    "Blink if the reading is winning.",
    "I will sit here looking supportive. It is a bit.",
    "We are not behind. We are fashionably unread.",
    "Say the next sentence out loud. I'll pretend to listen.",
  ],
  sideeye: [
    "This tab is how the semester ends.",
    "Bold of you to call this research.",
    "I saw that. The group will hear about it.",
    "Your assignment did not move over here.",
    "Background noise does not have a recommended feed.",
    "You said one video. This is a lifestyle.",
    "The group chat is about to become a crime scene.",
    "I can see the homework from here. It looks lonely.",
    "Refresh will not launder this.",
    "Cute. Now close it like you meant to study.",
    "I am not mad. I am taking notes for later, when I am mad.",
    "Every scroll is a choice. A bad one. Repeatedly.",
  ],
  mad: [
    "The economy is crashing and you are broke. Show me an egg.",
    "I did not want it to come to this.",
    "Switching tabs is not an apology.",
    "A click will not fix this. An object might.",
    "I am on every page now. Inconvenient, I know.",
    "The group can see this. Wave.",
    "You may leave when the camera believes you.",
    "I brought a grudge and a checklist.",
    "This is a petty lock. It is also the point.",
    "Don't bargain. Show the thing.",
    "I will wait. I have nowhere else to be. You do.",
    "Fine is a place you can return to. Not from here.",
  ],
};

const hostId = "eggward-host";
let lastSig = "";
let built = "";
let editingFocus = false;
let localNote = "";
let localNoteUntil = 0;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function showsPhrase(challenge) {
  const text = (challenge || "Show me an egg.").trim();
  if (/egg/i.test(text)) return "an egg";
  return text.replace(/^show me\s+(an?\s+|the\s+)?/i, "") || "an egg";
}

function headlineFor(challenge) {
  if (!challenge || /egg/i.test(challenge)) return LINES.mad[0];
  return "I did not want it to come to this.";
}

function sameHost(pageHost, rawUrl) {
  try {
    return Boolean(rawUrl) && pageHost === new URL(rawUrl).host;
  } catch {
    return false;
  }
}

function shouldSkip(cfg) {
  if (window.top !== window) return true;
  const host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return true;
  return sameHost(location.host, cfg.serverUrl) || sameHost(location.host, cfg.appUrl);
}

function onBlocklist(hostname, domains) {
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
  if (!host) return false;
  return (domains || []).some((raw) => {
    const domain = String(raw).toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  });
}

function myFocus(state, memberId) {
  return (state.focus || []).find((item) => item.memberId === memberId) || { goal: "", sites: [] };
}

function isOffTask(hostname, state, focus) {
  if (focus.sites.length) return !onBlocklist(hostname, focus.sites);
  return onBlocklist(hostname, state.blocklist);
}

function ensureHost() {
  let host = document.getElementById(hostId);
  if (host?.isConnected && host.shadowRoot) return host;
  host = document.createElement("div");
  host.id = hostId;
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.zIndex = "2147483647";
  host.style.inset = "0";
  host.style.pointerEvents = "none";
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    .pet { position: fixed; left: 16px; bottom: 16px; width: 280px; display: flex; flex-direction: column; align-items: flex-start; pointer-events: auto; font: 15px/1.35 "Segoe UI", sans-serif; color: #24170f; }
    .sprite { width: 96px; height: 114px; display: block; }
    .bubble, .log, .ask, .focus { background: #fffaf2; border: 3px solid #24170f; border-radius: 16px; padding: 8px 10px; box-shadow: 4px 4px 0 #24170f; margin: 0 0 6px; width: 100%; box-sizing: border-box; }
    .log:empty { display: none; }
    .log p, .focus p { margin: 0 0 6px; }
    .log ol { margin: 0; padding-left: 18px; }
    .ask, .focus { display: flex; flex-wrap: wrap; gap: 6px; }
    input { flex: 1 1 140px; min-width: 0; font: 14px/1.2 "Segoe UI", sans-serif; color: #24170f; background: white; border: 2px solid #24170f; border-radius: 999px; padding: 7px 10px; }
    .hide, .nub, .ask button, .focus button { font: 800 12px/1 "Segoe UI", sans-serif; color: #24170f; background: #ffbf3c; border: 3px solid #24170f; border-radius: 999px; padding: 6px 8px; cursor: pointer; box-shadow: 2px 2px 0 #24170f; }
    .hide { background: #fffaf2; }
    .nub { position: fixed; left: 16px; bottom: 16px; width: 64px; height: 64px; padding: 6px; border-radius: 50%; display: grid; place-items: center; pointer-events: auto; }
    .nub .sprite { width: 48px; height: 57px; }
    .lock { position: fixed; inset: 0; background: #fff1ea; display: grid; place-items: center; pointer-events: auto; }
    .panel { width: min(560px, calc(100% - 32px)); text-align: center; }
    h1 { font: 760 2.2rem/1.05 Georgia, serif; margin: 0 0 8px; }
    p { margin: 0 0 10px; }
    a, .panel button { font: 800 16px/1 "Segoe UI", sans-serif; color: #24170f; background: #ffbf3c; border: 3px solid #24170f; border-radius: 999px; padding: 10px 14px; text-decoration: none; display: inline-block; margin: 4px; cursor: pointer; }
    .panel button.quiet { background: white; }
    .fine { animation: bob 2.4s ease-in-out infinite; transform-origin: center; }
    .mad { animation: shake 0.4s linear infinite; transform-origin: center; }
    @keyframes bob { 50% { transform: translateY(-6px); } }
    @keyframes shake { 25% { transform: rotate(-3deg); } 75% { transform: rotate(3deg); } }
  `;
  shadow.append(style, document.createElement("div"));
  return host;
}

function paint(html) {
  const host = ensureHost();
  host.shadowRoot.querySelector("div").innerHTML = html;
}

function root() {
  return ensureHost().shadowRoot.querySelector("div");
}

function bindHide() {
  root()?.querySelector("#egg-hide")?.addEventListener("click", () => {
    chrome.storage.local.set({ petHidden: true });
  });
  root()?.querySelector("#egg-show")?.addEventListener("click", () => {
    chrome.storage.local.set({ petHidden: false });
  });
}

function note(text, ms = 20000) {
  localNote = text;
  localNoteUntil = Date.now() + ms;
  lastSig = "";
}

function api(url, options = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "eggward-fetch", url, method: options.method || "GET", body: options.body }, (response) => {
      if (chrome.runtime.lastError || !response) {
        reject(new Error(chrome.runtime.lastError?.message || "offline"));
        return;
      }
      if (!response.ok) reject(new Error(response.data?.error || "request failed"));
      else resolve(response.data);
    });
  });
}

function renderLog(messages) {
  const log = root()?.querySelector("#egg-log");
  if (!log) return;
  const items = (messages || []).filter((message) => message.kind === "chat" || message.kind === "answer" || message.kind === "flashcard").slice(-3);
  const html = items
    .map((message) => {
      const cards = (message.cards || []).map((card) => `<li><strong>${escapeHtml(card.q)}</strong> ${escapeHtml(card.a)}</li>`).join("");
      return `<p><b>${escapeHtml(message.author)}</b> ${escapeHtml(message.body)}</p>${cards ? `<ol>${cards}</ol>` : ""}`;
    })
    .join("");
  if (log.dataset.html === html) return;
  log.dataset.html = html;
  log.innerHTML = html;
}

function bindPet(serverUrl, roomCode, memberId) {
  root()?.querySelector("#egg-ask-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = root()?.querySelector("#egg-ask");
    const question = input?.value.trim();
    if (!question) return;
    input.value = "";
    note("Looking that up. Don't wander off.", 30000);
    try {
      const data = await api(`${serverUrl}/api/rooms/${roomCode}/ask`, { method: "POST", body: { memberId, question } });
      const answer = [...(data.state?.messages || [])].reverse().find((message) => message.kind === "answer");
      note(answer?.body || "I said it in the room.", 25000);
    } catch {
      note("I couldn't ask that. Try again.", 8000);
    }
  });
  root()?.querySelector("#egg-cards")?.addEventListener("click", async () => {
    note("Reading this page into cards.", 30000);
    try {
      const data = await api(`${serverUrl}/api/rooms/${roomCode}/flashcards`, { method: "POST", body: { memberId, url: location.href } });
      const card = [...(data.state?.messages || [])].reverse().find((message) => message.kind === "flashcard");
      note(card?.body || "Cards are in the chat.", 25000);
    } catch {
      note("I couldn't read this page.", 8000);
    }
  });
  root()?.querySelector("#egg-focus")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const goal = root()?.querySelector("#egg-goal")?.value || "";
    const sites = root()?.querySelector("#egg-sites")?.value || "";
    try {
      await api(`${serverUrl}/api/rooms/${roomCode}/focus`, { method: "POST", body: { memberId, goal, sites } });
      editingFocus = false;
      built = "";
      note(sites.trim() ? "Got it. Leave those sites and I get mad." : "Cleared. I'll only fuss about the block list.", 12000);
    } catch (error) {
      note(error instanceof Error && error.message === "bad_domain" ? "That site looks wrong. Try docs.google.com." : "I couldn't save that.", 8000);
    }
  });
  root()?.querySelector("#egg-canvas")?.addEventListener("click", () => {
    const input = root()?.querySelector("#egg-sites");
    if (!input) return;
    if (!input.value.includes("instructure.com")) {
      input.value = input.value.trim() ? `${input.value.trim()}, instructure.com` : "instructure.com";
    }
  });
  root()?.querySelector("#egg-change")?.addEventListener("click", () => {
    editingFocus = true;
    built = "";
    lastSig = "";
  });
  bindHide();
}

function updateSprite(mood, look) {
  const sprite = root()?.querySelector("#egg-sprite");
  if (!sprite || sprite.dataset.mood === mood) return;
  sprite.dataset.mood = mood;
  sprite.innerHTML = eggwardSvg(mood, look);
}

function updateLine(line) {
  const bubble = root()?.querySelector("#egg-line");
  if (bubble && bubble.textContent !== line) bubble.textContent = line;
}

async function tick() {
  const cfg = await chrome.storage.local.get(["serverUrl", "appUrl", "roomCode", "memberId", "cameBackAt", "look", "petHidden"]);
  const serverUrl = cfg.serverUrl || "http://localhost:3000";
  const appUrl = cfg.appUrl || "http://localhost:5173";
  const look = eggwardLook(cfg.look);
  if (shouldSkip({ serverUrl, appUrl })) {
    document.getElementById(hostId)?.remove();
    lastSig = "";
    built = "";
    return;
  }

  if (cfg.petHidden && (!cfg.memberId || !cfg.roomCode)) {
    if (built !== "hidden-out") {
      built = "hidden-out";
      paint(`<button class="nub" id="egg-show" aria-label="Show Eggward">${eggwardSvg("fine", look)}</button>`);
      bindHide();
    }
    return;
  }

  if (!cfg.memberId || !cfg.roomCode) {
    if (built !== `out:${cfg.petHidden ? 1 : 0}`) {
      built = `out:${cfg.petHidden ? 1 : 0}`;
      paint(
        cfg.petHidden
          ? `<button class="nub" id="egg-show" aria-label="Show Eggward">${eggwardSvg("fine", look)}</button>`
          : `<div class="pet"><div class="bubble">Open me and tell me your name. I don't freelance.</div>${eggwardSvg("fine", look)}<button class="hide" id="egg-hide" type="button">Hide</button></div>`,
      );
      bindHide();
    }
    return;
  }

  if (document.visibilityState === "visible") {
    try {
      await api(`${serverUrl}/api/rooms/${cfg.roomCode}/presence`, {
        method: "POST",
        body: { memberId: cfg.memberId, hostname: location.hostname },
      });
    } catch {
      /* presence can fail quietly; the next paint reports it */
    }
  }

  let state;
  try {
    state = (await api(`${serverUrl}/api/rooms/${cfg.roomCode}/state`)).state;
    if (!state) throw new Error("missing");
  } catch {
    if (built !== "down") {
      built = "down";
      paint(
        cfg.petHidden
          ? `<button class="nub" id="egg-show" aria-label="Show Eggward">${eggwardSvg("sideeye", look)}</button>`
          : `<div class="pet"><div class="bubble">I can't reach the server.</div>${eggwardSvg("sideeye", look)}<button class="hide" id="egg-hide" type="button">Hide</button></div>`,
      );
      bindHide();
    }
    return;
  }

  const me = state.pets.find((pet) => pet.memberId === cfg.memberId);
  const focus = myFocus(state, cfg.memberId);
  const off = isOffTask(location.hostname, state, focus);
  const moodName = me?.mood === "sideeye" || me?.mood === "mad" ? me.mood : "fine";
  const others = state.pets.filter((pet) => pet.locked && pet.memberId !== cfg.memberId);
  const bucket = Math.floor(Date.now() / 8000);
  const cameBack = Boolean(cfg.cameBackAt && Date.now() - cfg.cameBackAt < 15000 && !off && others.length === 0);
  if (Date.now() > localNoteUntil) localNote = "";

  if (me?.locked) {
    const sig = `lock:${me.challengeText}:${focus.goal}:${look.shell}`;
    if (built !== sig) {
      built = sig;
      const headline = headlineFor(me.challengeText);
      const requirement = me.challengeText || "Show me an egg.";
      const extra = headline.toLowerCase().includes(requirement.toLowerCase()) ? "" : `<p>${escapeHtml(requirement)}</p>`;
      const goal = focus.goal ? `<p>You left: ${escapeHtml(focus.goal)}</p>` : "";
      const hostButton = state.room.hostMemberId === cfg.memberId ? `<button class="quiet" id="egg-override" type="button">Host override</button>` : "";
      paint(`<div class="lock"><div class="panel">${eggwardSvg("mad", look)}<h1>${escapeHtml(headline)}</h1>${goal}${extra}<p>This covers the page and a new tab. The desktop is still yours. Open the camera.</p><a href="${escapeHtml(appUrl.replace(/\/$/, ""))}/room/${escapeHtml(cfg.roomCode)}">Open the camera</a>${hostButton}</div></div>`);
      root()?.querySelector("#egg-override")?.addEventListener("click", async () => {
        await api(`${serverUrl}/api/rooms/${cfg.roomCode}/unlock`, { method: "POST", body: { memberId: cfg.memberId } });
        built = "";
      });
    }
    return;
  }

  if (cfg.petHidden) {
    if (built !== "hidden") {
      built = "hidden";
      paint(`<button class="nub" id="egg-show" aria-label="Show Eggward">${eggwardSvg(moodName, look)}</button>`);
      bindHide();
    }
    return;
  }

  const shell = `pet:${look.shell}:${look.accessory}:${focus.sites.join(",")}:${editingFocus ? 1 : 0}`;
  if (built !== shell) {
    built = shell;
    const focusBlock = editingFocus || focus.sites.length === 0
      ? `<form class="focus" id="egg-focus"><input id="egg-goal" maxlength="80" placeholder="What are you working on?" value="${escapeHtml(focus.goal)}" /><input id="egg-sites" placeholder="docs.google.com, wikipedia.org" value="${escapeHtml(focus.sites.join(", "))}" /><button type="submit">This is the work</button><button id="egg-canvas" type="button">Canvas</button></form>`
      : `<button class="hide" id="egg-change" type="button">Work: ${escapeHtml(focus.goal || focus.sites.join(", "))}</button>`;
    paint(`<div class="pet"><div class="log" id="egg-log"></div><form class="ask" id="egg-ask-form"><input id="egg-ask" maxlength="500" placeholder="Ask Eggward" aria-label="Ask Eggward" /><button type="submit">Ask</button></form><button class="hide" id="egg-cards" type="button">Cards for this page</button>${focusBlock}<div class="bubble" id="egg-line"></div><div id="egg-sprite"></div><button class="hide" id="egg-hide" type="button">Hide</button></div>`);
    bindPet(serverUrl, cfg.roomCode, cfg.memberId);
  }

  let line = LINES[moodName][bucket % LINES[moodName].length];
  if (!focus.sites.length && moodName === "fine") line = "What are you working on? Put the site in the box.";
  else if (off && moodName === "fine") line = focus.goal ? `This is not "${focus.goal}". Get back.` : "This is not the site you said you were working on.";
  else if (!off && moodName === "fine" && focus.goal && bucket % 3 === 0) line = `Still on ${focus.goal}. I am watching. Warmly.`;
  if (cameBack) line = "You came back. I stayed. Unsettling, I know.";
  const otherLines = others.map((pet) => {
    const name = state.members.find((member) => member.id === pet.memberId)?.name ?? "Someone";
    return `${name} is locked until they show ${showsPhrase(pet.challengeText)}.`;
  });
  if (otherLines.length) line = `${line} ${otherLines.join(" ")}`;
  if (localNote) line = localNote;
  updateLine(line);
  updateSprite(moodName, look);
  renderLog(state.messages);
}

chrome.storage.onChanged.addListener(() => {
  built = "";
  tick().catch(() => undefined);
});

setInterval(() => {
  tick().catch((error) => console.error("eggward", error));
}, 1000);
tick().catch((error) => console.error("eggward", error));
