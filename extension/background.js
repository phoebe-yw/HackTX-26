chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "eggward-fetch" || typeof message.url !== "string") return;
  fetch(message.url, {
    method: message.method || "GET",
    headers: message.body ? { "Content-Type": "application/json" } : undefined,
    body: message.body ? JSON.stringify(message.body) : undefined,
  })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      sendResponse({ ok: response.ok, data });
    })
    .catch((error) => sendResponse({ ok: false, data: { error: error instanceof Error ? error.message : "offline" } }));
  return true;
});

chrome.idle.setDetectionInterval(60);

chrome.idle.onStateChanged.addListener((state) => {
  if (state === "active") {
    chrome.storage.local.set({ cameBackAt: Date.now() });
  }
});

chrome.alarms.create("eggward-heartbeat", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(() => {
  chrome.storage.local.set({ heartbeatAt: Date.now() });
});
