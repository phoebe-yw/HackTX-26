# Once Upon a Focus 🏰

*A tiny fairytale companion that lives on your screen, keeps you locked in while you study, and turns your breaks into time with friends.* — HackTX '26, **#OnceUponAHack**

Pick a character (Red Riding Hood, Cinderella, the Wolf, the Duck, Humpty Dumpty), tell it what you're studying, and it floats over every page. It cheers while you focus, gets *suspicious → annoyed → FURIOUS* when you drift, **sees your screen with Gemini** to roast you about what you're actually watching, and finally **locks the page down** until you pass a ridiculous challenge. On breaks, the Tavern opens: race a friend or a stranger at a fairytale word game, with an AI icebreaker, chat, and an add-friend button. A Group Study Room lets friends share one AI chat and conjure flashcards together.

## Tracks
- **Best Use of Gemini API** — Gemini is the pet's *eyes* and its *social brain*. `visionAI` sends a downscaled screenshot to Gemini Flash for structured-JSON focus detection, roasts that reference what's really on screen, and "👁️ look at my screen" Q&A. `socialAI` uses Gemini for the Group Study Room, shared flashcards/quizzes, break-time icebreakers, and friend challenges. The UI shows a badge when Gemini answered, and falls back to a curated offline storybook if it can't.
- **Jester's Court — Most Entertaining** — a pet with a mood state machine, five personalities, Gemini roasts, a storm-in LOCKDOWN with riddles, study quizzes, oaths typed backwards, and a glass-slipper unlock.

## Setup
```bash
npm install
cp .env.example .env     # then paste keys (see below)
npm run build            # → dist/chrome-mv3
```
Load it: Chrome → `chrome://extensions` → **Developer mode** → **Load unpacked** → select `dist/chrome-mv3`. Onboarding opens automatically.

For development with hot reload: `npm run dev` (WXT opens a Chrome profile with the extension loaded).

### `.env`
| var | what |
|---|---|
| `WXT_GEMINI_API_KEY` | Gemini key (required for all AI; without it everything falls back to curated content) |
| `WXT_GEMINI_MODEL` / `WXT_GEMINI_LITE_MODEL` | defaults `gemini-3.8-flash` / `gemini-3.5-flash-lite` |
| `WXT_FIREBASE_*` | Firebase web config (optional; without it social runs in **local mode**: demo friends + bot opponent) |

Keys are compiled into the local unpacked build only. `.env` is gitignored.

### Firebase setup (for real friends / rooms / matchmaking) — ~5 minutes
1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (any name, Analytics off).
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**
3. **Build → Firestore Database → Create database → Start in test mode** (open rules are fine for the hackathon).
4. Project settings (gear) → **Your apps → Web (</>)** → register → copy `apiKey`, `authDomain`, `projectId`, `appId` into `.env` as `WXT_FIREBASE_API_KEY`, `WXT_FIREBASE_AUTH_DOMAIN`, `WXT_FIREBASE_PROJECT_ID`, `WXT_FIREBASE_APP_ID`.
5. `npm run build` → reload the extension. The Study Table badge flips from `local` to `live`.

A second Chrome profile with the same build = a second user (anonymous auth is per profile). Share friend codes from the Study Table.

## Demo Mode
Options page (widget menu ☰ → Settings, or the toolbar popup) → **Demo & dev** → toggle **Demo Mode**:
- timers in seconds (25 min → 25 s), mood climbs to LOCKDOWN in ~30 s of drifting, screen check every 5 s
- Study Table seeded with clearly-labelled demo friends; Tavern has a guaranteed "Mysterious Stranger" bot
- mood slider, force-lockdown buttons (riddle / quiz / oath / friend), Gemini/offline toggle, Ping Gemini, **Test all socialAI functions**, Screen check now

### 3-minute demo script
1. Onboarding: pick a character, name it, type your topic.
2. **Begin the chapter** — the clock ticks, friends sit at the Study Table.
3. Ask → toggle **👁️ look at my screen** → "explain this diagram" → Gemini answers from the screenshot.
4. Open YouTube → suspicious → annoyed → FURIOUS with Gemini roasts about the video → **LOCKDOWN** storms in → solve the trial (ideally a friend's challenge) → glass-slipper unlock.
5. Clock strikes → Break Tavern → Find someone → icebreaker → Spellbound race → add friend.
6. Ask → Group Study Room → conjure shared flashcards.

## Architecture
```
src/entrypoints/
  background.ts         service worker: session timer (alarms), mood engine, screenshots, AI calls, message hub
  content/              every page: Shadow DOM widget + lockdown overlay
  offscreen/            extension-origin page hosting the social backend (Firebase or local) → mirrors to storage.session
  options/              storybook onboarding, settings, hidden Demo & dev panel
  popup/                enable/disable, demo toggle
src/ai/
  types.ts              TextProvider { chat(), json() } — the only thing features call
  providers/            gemini.ts (SDK) · offline.ts
  visionAI.ts           checkScreen · classifySite · roast · askAboutScreen   (Gemini)
  socialAI.ts           groupReply · generateFlashcards · generateQuiz · riddle · icebreaker · generateChallenge · quote
  chain.ts / config.ts  fallback chain (preferred → gemini → curated), env + live overrides, provider logging
  prompts/ schemas.ts   provider-neutral prompts, zod schemas
src/core/               types, storage, messaging, session, mood, engine, lockdown
src/social/             backend.ts (base + LocalBackend) · firestore.ts · words.ts · bot.ts · client.ts
src/ui/                 theme.css, CharacterArt (SVG placeholders w/ PNG override), widget pages, lockdown
public/assets/characters/<id>/meta.json   art pipeline: drop PNGs, set hasArt:true
```

### Permissions
`storage` (all state) · `alarms` (timer + ticks across service-worker sleep) · `idle` (idle signal) · `tabs` (active-tab URL/title + `captureVisibleTab`) · `offscreen` (Firebase host) · `scripting` (put the widget back into open tabs after an install/update) · host permission `<all_urls>` (inject the widget everywhere, screenshots).

### Privacy
Screen peeking is **opt-in**, only during focus sessions, downscaled, never stored, skipped on sensitive sites (mail, banking, password managers), in incognito, and on allowlisted study sites. A 👁️ shows whenever the pet is looking.

## Replacing the placeholder art
Draw transparent PNGs, **512×512**, character centered (~80% height, ~10% padding), facing slightly right, for `idle, happy, suspicious, annoyed, furious, sleeping, celebrate`. Drop them in `public/assets/characters/<id>/`, set `"hasArt": true` in that folder's `meta.json`, rebuild.

## Future work
iPad/phone companion · Canvas/LMS goals · Gemini-generated custom pets · voice "quiz me" mode.
