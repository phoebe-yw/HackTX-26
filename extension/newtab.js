const stage = document.querySelector("#stage");

function headline(challenge) {
  if (!challenge || /egg/i.test(challenge)) return "The economy is crashing and you are broke. Show me an egg.";
  return "I did not want it to come to this.";
}

async function paint() {
  const cfg = await chrome.storage.local.get(["serverUrl", "appUrl", "roomCode", "memberId", "look"]);
  const look = eggwardLook(cfg.look);
  if (!cfg.roomCode || !cfg.memberId) {
    stage.innerHTML = `<h1>Open Eggward first.</h1><p>The extension popup is where you join a room. A new tab is not a way around me.</p>${eggwardSvg("fine", look)}`;
    return;
  }
  const serverUrl = cfg.serverUrl || "http://localhost:3000";
  const appUrl = (cfg.appUrl || "http://localhost:5173").replace(/\/$/, "");
  let state;
  try {
    const response = await fetch(`${serverUrl}/api/rooms/${cfg.roomCode}/state`);
    state = (await response.json()).state;
  } catch {
    stage.innerHTML = `<h1>I can't reach the server.</h1>${eggwardSvg("sideeye", look)}`;
    return;
  }
  const pet = state.pets.find((item) => item.memberId === cfg.memberId);
  const focus = (state.focus || []).find((item) => item.memberId === cfg.memberId);
  if (pet?.locked) {
    const extra = pet.challengeText && !/egg/i.test(pet.challengeText) ? `<p>Show ${pet.challengeText}.</p>` : "";
    const goal = focus?.goal ? `<p>You left: ${focus.goal}</p>` : "";
    stage.innerHTML = `<h1>${headline(pet.challengeText)}</h1>${goal}${extra}<p>A new tab is still the lock. This does not lock Windows. The camera does.</p><p><a href="${appUrl}/room/${cfg.roomCode}">Open the camera</a></p>${eggwardSvg("mad", look)}`;
    return;
  }
  const sites = (focus?.sites || []).map((site) => `<a href="https://${site}">${site}</a>`).join(" · ");
  stage.innerHTML = `<h1>${focus?.goal ? focus.goal : "What are you working on?"}</h1><p>${sites || "Set your work sites on the egg in the corner. Until then, only the block list makes me mad."}</p>${eggwardSvg(pet?.mood, look)}`;
}

paint().catch(() => undefined);
setInterval(() => {
  paint().catch(() => undefined);
}, 2000);
