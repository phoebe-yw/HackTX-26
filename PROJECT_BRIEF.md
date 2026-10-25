# PROJECT BRIEF — "Once Upon a Focus" (working title)
### A fairytale study-buddy Chrome extension · HackTX '26

> ⏰ **We are starting at 7:00pm Saturday. Final submission is due 11:30am Sunday — about 16.5 hours total.** Every plan you propose must fit inside that window (see Section 9).

You are the lead engineer on a hackathon team. Read this entire brief before doing anything. **Do not write, generate, or install any code until we have approved your plan** (see "Working Agreement" below). Your job is to help us ship a polished, reliable, *demoable* project that wins the tracks listed below — not to build every idea in this document.

---

## 0. Working Agreement (read first, follow always)

These rules override everything else in this brief.

1. **Plan before code.** Your first response must contain ONLY:
   - A 5–8 sentence restatement of what we're building, in your own words.
   - Every question, ambiguity, or risk you see (number them so we can answer quickly).
   - A proposed architecture, folder structure, and tech stack with a one-line reason for each choice.
   - A phased build plan mapped to the timeline in Section 9.
   - Then STOP and wait for us to say "approved" (or give changes).
2. **Check in before every phase.** Before starting each phase, post a short plan (files you'll create/change, packages you'll add, what we'll be able to see when it's done) and wait for "go".
3. **Check in after every phase.** When a phase is done, tell us exactly how to load and test it (step by step), list what's working, what's stubbed/faked, and any bugs you know about. Wait for us to confirm it works on our machines before moving on.
4. **Periodic status checks.** Every time we start a new chat or a new phase, compare progress against the timeline in Section 9. If we're behind, say so plainly and propose specific cuts — don't silently keep building.
5. **Never without asking:** add a major dependency, change the architecture, change the data model, delete files, rename things broadly, or touch API keys/secrets.
6. **Keep a `PROGRESS.md`** at the repo root: a checklist of phases/features with status (✅ done / 🟡 partial / ⛔ cut / ⬜ not started), known bugs, and decisions we made. Update it at the end of every phase.
7. **Don't guess at APIs.** For the Gemini API and especially Meta's Muse APIs, ask us for current docs/links or check official docs before writing integration code. Model names and SDKs change — don't hardcode a model name from memory without confirming it. Right now we only have a **free Gemini key**, so everything runs on Gemini for now; the Meta Muse provider gets wired in later (see Section 7.1). Don't write the real Meta integration until we give you docs and a key.
8. **Small, working increments.** Every phase should end with something we can load in Chrome and click on. Never leave the extension in a broken state at the end of a phase.
9. **Demo-first mindset.** When choosing between "more features" and "the existing features work flawlessly and look great," choose the latter.

---

## 1. The Hackathon Context

- **Event:** HackTX '26 at UT Austin, hosted by Freetail Hackers. 24 hours of hacking (Saturday 11:30am → Sunday 11:30am).
- **Theme:** **"Once Upon a Hack"** — a storybook / fairytale theme (`#OnceUponAHack`). Prize tracks have names like *Cinderella's Castle*, *Jester's Court*, *A Bard's Tale*, *Brick House*, *The First Chapter*.
- **Deadlines:** Soft Devpost submission Saturday 11:30pm. Final submission Sunday 11:30am. Live judging Sunday 2–5pm (judges walk up to our table and we demo live).
- **Rules that matter:** all code must be written during the hacking period; we can submit to up to 3 tracks (excluding Best Overall / Best Novice).

### Tracks we're targeting (design every feature with these in mind)

**A. Best Use of Gemini API (MLH + Google Cloud)** — *"Unlock superpowers with Gemini's multimodality and flash models."*
→ Judges want to see Gemini doing something only a multimodal model can do, and doing it fast. Our answer: the pet literally **sees your screen** (screenshot → Gemini Flash) to know whether you're studying, roasts you about what it sees, and answers questions about what's on your screen.

**B. Meta — "Bringing People Closer Together with AI"** — *"Build the AI-powered social product you wish existed, or one that helps strengthen connections you care about."* Meta encourages use of:
- **Muse Spark** — text model for chat, reasoning, and agentic experiences
- **Muse Image** — image-generation model
- **Muse Voice Transcribe** — real-time audio perception model
- **Muse** — Meta's personal AI agent; teams can write connectors that expose their project's data/actions as tools Muse can call
- **Facebook Graph API** — public and user-consented data
Prize: top 3 teams get invited to a Round 2 hackathon at Menlo Park.
→ Our answer: studying is lonely; we make it social. A shared study table with friends, a group AI study room powered by Muse Spark (shared flashcards/quizzes), break-time games with friends or new people, and friend-to-friend challenges.

**C. Jester's Court — Most Entertaining (PS5)**
→ Our answer: the pet has a personality. It's cute and funny when you're focused, gets increasingly dramatic when you drift, and eventually **gets mad, takes over your screen, and makes you complete a ridiculous challenge** to get back. This is the "wow, ha!" moment of our demo.

**Division of AI labor (important for judging clarity):**
- **Gemini = the pet's eyes.** Screen understanding, distraction detection, roasts based on what it sees, "explain what's on my screen" Q&A. *Always Gemini.*
- **Meta Muse = the social brain.** Group study room chat, shared flashcard/quiz generation, break-time icebreakers/matchmaking, friend challenge generation. Stretch: Muse Image for custom pets, Muse Voice for talking to your pet, a Muse connector.

**Current reality:** we only have a free Gemini key, so **during development the social brain also runs on Gemini.** Near the deadline (target: Sunday ~8:00am, see Section 9) we switch the social features to our Meta API key. That switch must be a config change, not a rewrite — see Section 7.1.

Keep this split clean in code (separate modules) and in the UI (so we can point to it during the pitch).

---

## 2. The Product

**One-liner:** A tiny fairytale companion that lives on your screen, keeps you locked in while you study, and turns your breaks into time with friends.

**Target audience:** Students who get distracted easily.

**Impact:** Helps students stay locked in, and makes studying feel less isolating by connecting them with friends (and new friends) during sessions and breaks.

**Form factor:** A **Chrome extension (Manifest V3)**. NOT a webpage. It's a small floating character that sits on top of whatever web page you're on. It only takes over the full screen when you're *not* locked in.

> Open question for us to confirm in your plan: Chrome extension (only works inside Chrome tabs, much faster to build) vs. Electron desktop app (floats over everything, much more work). Our default is the Chrome extension — flag any reason we should reconsider.

---

## 3. Core Features (MVP — must work in the demo)

### 3.1 Onboarding (first launch)
A short, charming storybook-style flow (3–4 "pages"):
1. **Choose your character:** Red Riding Hood, Cinderella, the Wolf, the Duck, Humpty Dumpty. Each has a distinct personality/voice (see 3.4). Let the user name it.
2. **What are you studying?** Free text (e.g. "Organic Chemistry — chapter 7 reactions"). This feeds the AI so it knows what "on task" means and can generate relevant challenges/quizzes.
3. **Study method:** presets + custom.
   - Pomodoro (25 min focus / 5 min break, 15 min long break every 4)
   - 52 / 17
   - Deep Work (90 / 20)
   - Custom (focus length, break length, long-break length, long-break frequency)
   - Or "No method — just keep me focused"
4. **Strictness:** Gentle 🧚 · Firm 🛡️ · Big Bad Wolf 🐺 (how fast the pet escalates and how hard the challenges are).
5. Optional: sites that are always OK (e.g. Canvas, Google Docs) and always distracting (e.g. YouTube, Instagram, TikTok, Reddit).

All settings editable later.

### 3.2 The floating widget
- Injected into every page via a content script, rendered inside a **Shadow DOM** so host-page CSS can't break it (and ours can't break theirs). Max z-index.
- **Draggable** anywhere on screen; position remembered per user (not per site).
- **Resizable** (at minimum Small / Medium / Large; a drag handle is a bonus).
- **Collapsed state:** just the character + a tiny timer ring. Click to expand.
- **Hide** (on this site / for N minutes) and **Disable** (pause the extension). If you hide or disable it *during a focus session*, the character reacts (guilt-trip joke) — but it must still let you.
- Must never block clicking the page underneath when collapsed.

### 3.3 Widget "pages" (storybook pages you flip between inside the small widget)
1. **Home** — the character (animated idle), current mood, a speech bubble with occasional jokes/encouragement, and the session timer styled as **Cinderella's clock** (the clock "strikes" when it's break time).
2. **Study Table** — a little table with all your friends who are currently studying: name, character avatar, status (🟢 focusing · ☕ on break · 😵 distracted), time studied today. Buttons: nudge, send a challenge.
3. **Ask** — AI chat box.
   - Default: personal chat with the pet (Gemini). A "👁️ look at my screen" toggle attaches a screenshot of the current tab so you can ask "explain this diagram" or "what does this error mean?"
   - **Group Study Room:** invite friends into the *same* AI chat. Everyone sees the messages; the AI (Muse Spark) answers the group, and can generate **shared flashcards / quick quizzes** from the topic or pasted notes. Simple flashcard viewer included.
4. **Quotes** — motivational quotes delivered in the character's voice, fairytale-flavored ("Even Cinderella had a deadline: midnight."). Can be a curated list + optional AI-generated ones.
5. **Break Tavern** (games/social) — see 3.6. Only unlocked during breaks or after a session ends.

### 3.4 Personality & mood system (the heart of "Most Entertaining")
The pet has a **mood state machine** driven by a focus signal:

`😊 Happy → 🤨 Suspicious → 😤 Annoyed → 😡 FURIOUS → 🔒 LOCKDOWN`

- Escalation speed depends on the strictness setting. De-escalates when you get back on task.
- Each level has its own animation/pose and lines. Lines are funny, short, and in character:
  - **Red Riding Hood:** sweet but sassy, basket full of snacks, references the woods/path ("Stay on the path!").
  - **Cinderella:** obsessed with the clock and midnight deadlines.
  - **The Wolf:** dramatic villain energy, huffing and puffing, threatens to blow your tabs down.
  - **The Duck:** chaotic, honks, passive-aggressive.
  - **Humpty Dumpty:** anxious, fragile, "you're going to make me FALL."
- Jokes appear occasionally when you're unlocked/drifting and occasionally as positive reinforcement when you're focused — not spammy.
- **Gemini-powered roasts:** when you're caught, the line references what's actually on your screen ("My, what big eyes you have… for a cat compilation.").

### 3.5 Distraction detection & Lockdown
**Signals** (cheap → expensive):
1. Active tab URL/title vs. the allow/block lists.
2. Unknown sites: quick Gemini text classification of title/URL vs. the study topic (cache results per domain).
3. Idle detection (`chrome.idle`).
4. **Screen check (Gemini multimodal):** during focus sessions only, periodically capture the visible tab (`chrome.tabs.captureVisibleTab`), downscale it, and ask Gemini Flash for structured JSON, e.g.:
   ```json
   { "on_task": false, "confidence": 0.86, "activity": "watching a YouTube video about cats", "roast_hook": "cat compilation" }
   ```
   Never store screenshots. Show a visible indicator when the pet is "looking." Make this opt-in during onboarding.

**Lockdown (when FURIOUS boils over):**
- A full-screen overlay on the current tab with a dramatic, funny entrance (the character storms in, screen "shakes", fairytale flourish).
- The user must complete **a funny challenge** to unlock. MVP challenge types (pick at random, weighted by strictness):
  - **Riddle from the character** (AI-generated or curated, fairytale-themed).
  - **Study Quiz** — 1–3 questions generated from *what they said they're studying* (so the punishment is actually productive).
  - **The Oath** — type a silly pledge exactly (e.g. "I solemnly swear to stop watching the Duck videos"), maybe backwards on Big Bad Wolf mode.
  - **Friend's Challenge** — if a friend sent you a challenge, it shows up here (see 3.6).
- **Safety valve:** there must always be a way out (e.g. hold Esc for 5 seconds → "I really need this" → the pet sulks and it's logged). Never make the browser unusable.

### 3.6 Social: Study Table, Break Tavern, Friends
- **Accounts:** quick sign-in (Google sign-in or anonymous + display name — propose what's fastest).
- **Friends:** add by username or invite code; friend list; accept/decline.
- **Presence:** friends' live status on the Study Table.
- **Friend challenges:** send a friend a challenge (write your own, or have Muse Spark generate one); it appears the next time they get locked out. Bonus: you get notified whether they passed.
- **Break Tavern (MVP = ONE game):** during breaks, play a quick word game:
  - with a friend, or
  - **"Find someone"** — match with any other online user who's also on break.
  - In-game/match **chat**, and an **"Add friend"** button after the game.
  - Muse Spark generates a fun **icebreaker** when you get matched with a stranger.
- Pick ONE game for MVP and make it great. Candidates (propose the fastest to make multiplayer): fairytale-themed **Wordle race** ("Spellbound"), mini **Connections** with fairytale categories, or a **mini crossword**. Other games are stretch goals.

---

## 4. Stretch Goals (only after MVP is solid and we say so)
Items 1–3 need the Meta key, so they're only possible after the switch in Section 7.1. In rough priority order:
1. **Muse connector** — expose actions/data as tools Muse can call (e.g. `start_study_session`, `get_focus_stats`, `challenge_friend`). Strong signal for the Meta track.
2. **Muse Image** — generate a custom pet / accessories / victory stickers.
3. **Muse Voice Transcribe** — talk to your pet ("quiz me", "start a session").
4. Second break game.
5. Sound effects + character voice lines.
6. Streaks, daily stats, "XP" for the pet.

## 5. Explicitly OUT of scope for this hackathon (mention as "future work" in the pitch)
- iPad / phone companion and cross-device sync
- Canvas / LMS integration and assignment goals
- Facebook Graph API friend import (likely needs app review)
- Anything outside the Chrome browser

---

## 6. Visual Design — "Once Upon a Hack" storybook aesthetic

Match the official HackTX '26 look so the project feels native to the event:
- **Vibe:** illustrated vintage storybook — parchment pages, curling beanstalk vines, gilded frames, a little whimsical and a little spooky (the event mascot is a cute brown bat dressed up as fairytale characters: Robin Hood, mermaid, wizard on a wand, Red Riding Hood, witch on a broom).
- **Event assets for inspiration:** a blue potion bottle, an "EAT ME" heart cookie, a golden genie lamp, a sparkling glass slipper, Cinderella's clock-tower castle with a spiral staircase, a big oak tree, an ornate gold oval mirror. (Don't copy the event's art; use these as motifs/icons for our own UI — e.g. the mirror frame for the AI chat, the clock tower for the timer, the glass slipper for "you unlocked!".)
- **Palette (approximate, refine as needed):**
  - Parchment / cream background `#FBF8EE`
  - Ink brown (text, outlines) `#3D2E1A`
  - Moss olive `#5B6236` · Sage green `#87A28A` · Deep forest `#2F3A2A`
  - Crimson (Red Riding Hood, warnings) `#A3304A`
  - Gold (accents, sparkles, rewards) `#D9B44A`
  - Powder blue (glass slipper, potion, calm states) `#8EB9CC`
- **Type:** a blackletter / storybook display font for titles (e.g. Pirata One, UnifrakturCook, or similar from Google Fonts) + a friendly rounded sans for body text (e.g. Nunito). **Bundle font files inside the extension** (`web_accessible_resources`) — don't load from Google's CDN in content scripts (host page CSP will block it).
- **Motion:** gentle idle bobbing, page-flip transitions between widget pages, sparkle bursts for wins, screen-shake + storm entrance for lockdown. Keep it smooth and lightweight.
- **Tone of copy:** cute, punny, fairytale. Every empty state and error message should have personality.

### Character art pipeline (IMPORTANT)
We will replace placeholder art with **our own drawings** later. Build an asset system so swapping is trivial:
```
/assets/characters/<characterId>/
    idle.png  happy.png  suspicious.png  annoyed.png  furious.png  sleeping.png  celebrate.png
    meta.json   // name, personality blurb, voice lines, colors
```
- Use simple, clean placeholders for now (SVG/CSS shapes, not copied from any studio's character designs — e.g. no Disney-style Cinderella).
- Tell us the exact image specs we should draw to (we suggest transparent PNG, 512×512, character centered with padding).

---

## 7. Technical Requirements & Known Gotchas

Propose your stack in the plan; here are our expectations and the traps we want you to plan around:

- **Chrome Extension, Manifest V3**, TypeScript, React for UI, Vite-based build (e.g. WXT or CRXJS — recommend one and explain why). Hot reload during development is a big win.
- **Content script + Shadow DOM** for the widget and the lockdown overlay.
- **MV3 service workers go to sleep.** Don't keep timers in memory — use `chrome.alarms` + `chrome.storage` for session state. Keep timer display synced across tabs.
- **Realtime/social backend:** propose the fastest option (e.g. Firebase Auth + Firestore/Realtime DB for presence, rooms, chat, game state; or Supabase). Plan where realtime listeners live, since the service worker can sleep (e.g. widget context or an offscreen document).
- **Secrets:** no API keys committed to the repo (it will be public on Devpost). Use `.env` + `.gitignore` locally; propose a tiny proxy backend for Gemini/Meta calls if time allows, and tell us the trade-off.
- **Gemini:** use a Flash model via the official Google Gen AI SDK. Confirm current model names in the official docs. Use structured JSON output for the screen-check classifier. Downscale screenshots to keep latency low. We're on the **free tier**, so respect rate limits: cache per-domain classifications, keep screen checks infrequent (and faster only in Demo Mode), and back off on 429 errors instead of crashing.
- **Graceful failure everywhere:** if any AI call fails or is slow, fall back to curated lines/riddles/quizzes so the demo never breaks.
- **Permissions:** request only what we need; explain each permission in the plan (`tabs`, `activeTab`/host permissions for screenshots, `storage`, `alarms`, `idle`, etc.).
- **Privacy:** screenshots are opt-in, never stored, never sent while not in a focus session, skipped on incognito and on obviously sensitive sites (banking, email).

### 7.1 Swappable AI providers (Gemini now → Meta later)
Today only Gemini works. Before the deadline we'll switch the social features to Meta's Muse API. Build it so that switch takes **under 10 minutes and touches no feature code**:

- **Two AI modules with one interface each.** No feature, component, or prompt file may import a provider SDK directly — features only call these interfaces:
  - `visionAI` — `checkScreen()`, `roast()`, `askAboutScreen()`. **Always Gemini** (this is our Gemini-track feature).
  - `socialAI` — `groupReply()`, `generateFlashcards()`, `generateQuiz()`, `icebreaker()`, `generateChallenge()`, `quote()`. **Gemini now, Meta Muse later.**
- **Providers are plug-ins.** e.g. `src/ai/providers/gemini.ts` and `src/ai/providers/meta.ts`, both implementing the same `TextProvider` interface (`chat(messages, options)`, `json(messages, schema)`). Create `meta.ts` now as a clearly marked stub that throws "not configured" — we'll fill it in once we have Meta's docs.
- **One config switch.** Choose the provider per module from config/env, e.g.:
  ```
  GEMINI_API_KEY=...
  META_API_KEY=
  SOCIAL_AI_PROVIDER=gemini   # flip to "meta" near the deadline
  VISION_AI_PROVIDER=gemini   # stays gemini
  ```
  Also add a toggle for this in the hidden Demo Mode / dev settings panel so we can flip providers live without rebuilding.
- **Provider-neutral prompts.** Keep prompts and character personalities in their own files (e.g. `src/ai/prompts/`), written in plain text that works with any chat model. Request JSON with a schema and validate the result, so a different model's formatting quirks don't break the UI.
- **Automatic fallback chain:** if Meta fails → fall back to Gemini → fall back to curated offline content. Log which provider answered.
- **Visible provider badge.** In the Group Study Room and Break Tavern, show a small "✨ Powered by Meta Muse" / "Powered by Gemini" badge based on which provider actually answered. This is what we'll point to for each track's judges.
- **Write `SWITCH_TO_META.md`:** a step-by-step checklist for the swap (where to paste the key, what to change in `meta.ts`, how to test each `socialAI` function, how to roll back). Include a single test command or dev-panel button that calls every `socialAI` function once and reports pass/fail per provider.

**Do the switch early, not last.** We plan to flip to Meta by **~8:00am Sunday**, giving us time to fix problems before submission. If the Meta API isn't working by 9:30am, we demo with Gemini for social features and explain that the Meta provider is already integrated.

---

## 8. Demo Mode (non-negotiable)
Judges get ~3–5 minutes at our table. Build a hidden **Demo Mode** toggle that:
- Compresses timers (25 min → 25 sec, etc.).
- Escalates mood fast so we can trigger a lockdown on cue by opening YouTube.
- Seeds the Study Table with a few fake friends (clearly fake data behind the toggle) in case venue Wi-Fi is bad or friends aren't online.
- Has a guaranteed "stranger" to match with in the Break Tavern (a second browser profile or a bot).

**The 3-minute demo script we're building toward:**
1. Pick a character in onboarding (10 sec of charm).
2. Start a focus session on our study topic — the pet is happy, Cinderella's clock ticks, friends on the Study Table.
3. Ask the pet about a diagram on screen → Gemini answers using the screenshot.
4. Open YouTube → pet escalates (Suspicious → Annoyed → FURIOUS) with roasts about the actual video → **LOCKDOWN** storm-in → solve a funny challenge (ideally a friend's challenge) → glass-slipper "unlocked" sparkle.
5. Clock strikes break time → Break Tavern → match with a stranger, Muse icebreaker, play the game, add them as a friend.
6. Pop into the Group Study Room → Muse Spark generates shared flashcards for the group.

Every feature should earn its place in that script. If it's not in the script, it's lower priority.

---

## 9. Timeline (starting **Saturday 7:00pm** → due **Sunday 11:30am**, ~16.5 hours)
Phases are checkpoints — check in with us at the start and end of each. This is tight, so plans must be lean.

| Phase | Target time | Goal (what we can see) |
|---|---|---|
| 0 | 7:00–8:00pm Sat | Plan approved. Extension scaffolded, loads in Chrome, placeholder character floats on any page, draggable. AI provider layer skeleton (Section 7.1) in place with Gemini working and Meta stubbed. |
| 1 | 8:00–10:00pm | Onboarding, character select, settings, session timer (Cinderella clock), widget pages shell, collapse/resize/hide. |
| 2 | 10:00pm–12:30am | Mood state machine (URL-based signals) + Lockdown overlay + 3 challenge types + safety valve. **Core loop demoable.** **Soft submit to Devpost at 11:30pm** with whatever works (short description + screenshot is fine). |
| 3 | 12:30–3:00am | Gemini: screen check, roasts, "look at my screen" chat. Demo Mode v1. |
| 4 | 3:00–5:30am | Accounts, friends, Study Table presence, friend challenges. |
| 5 | 5:30–8:00am | Group Study Room + flashcards (via `socialAI`), Break Tavern game + matchmaking + chat + add friend. **Feature freeze at 8:00am.** |
| 6a | 8:00–9:30am | **Switch `socialAI` to Meta** using `SWITCH_TO_META.md`, run the provider test, fix issues. Swap in our drawings. If Meta isn't working by 9:30am, roll back to Gemini and move on. |
| 6b | 9:30–11:30am | Polish animations/copy, bug bash, record a backup demo video, README + Devpost write-up mapping features to each track. **Aim to submit by 11:00am** — leave 30 min of buffer. |

If any phase runs more than ~30 minutes over, stop and propose cuts. Cut in this order: stretch goals → friend challenges → Group Study Room polish → stranger matchmaking (keep friend games) → Study Table presence (use Demo Mode fake friends). **Never cut** the floating pet, the mood system, Lockdown + challenges, the Gemini screen check, or Demo Mode.

---

## 10. Deliverables
- Working unpacked Chrome extension + clear README (setup, env vars, how to load, how to toggle Demo Mode).
- `PROGRESS.md` kept current.
- A Devpost write-up draft (Inspiration / What it does / How we built it / Challenges / Accomplishments / What's next) with a short section explicitly showing how we use **Gemini multimodality + Flash**, how we use **Meta's Muse tools** to bring people closer together, and why it's the most **entertaining** project in the room.

---

**Remember: your first reply is the plan + questions only. No code until we say "approved."**
