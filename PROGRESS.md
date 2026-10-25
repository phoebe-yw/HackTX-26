# PROGRESS — Once Upon a Focus

Legend: ✅ done · 🟡 partial · ⛔ cut · ⬜ not started

Timeline (Sat 7:00pm → Sun 11:30am). Plan approved Sat 7:30pm. Team asked to run phases back-to-back and review later.

## Phases

| Phase | Target | Status | Notes |
|---|---|---|---|
| 0 Scaffold + AI layer | 7–8pm | ✅ | WXT + React + TS, floating draggable pet, `visionAI`/`socialAI` with Gemini + offline fallback |
| 1 Onboarding, timer, widget shell | 8–10pm | ✅ | Storybook onboarding, settings, Cinderella clock, pages, collapse/size/hide/disable |
| 2 Mood + Lockdown + challenges | 10pm–12:30am | ✅ | URL/list + idle signals, 4 levels, lockdown on all tabs, riddle/quiz/oath/friend, hold-Esc valve |
| 3 Gemini eyes + Demo Mode v1 | 12:30–3am | ✅ | Screen check (structured JSON), roasts, "look at my screen" chat, domain cache, 429 cooldown, dev panel |
| 4 Accounts, friends, Study Table | 3–5:30am | 🟡 | Firebase project `once-upon-a-focus` live: anonymous sign-in works, `users/` + `codes/` docs written (verified via REST, Sat 11:40pm). Friends/nudges/challenges still need a two-profile test. |
| 5 Group Study Room + Break Tavern | 5:30–8am | 🟡 | Code complete: rooms + shared flashcards/quiz, Spellbound race, matchmaking (Firestore transaction), bot stranger, chat, add friend. Not yet exercised against Firestore. |
| 6a Switch socialAI → Meta | — | ⛔ | Dropped Sat 11:25pm: team is going Gemini-only. `meta.ts` and `SWITCH_TO_META.md` removed. |
| 6b Polish, video, README, Devpost | 9:30–11:30am | 🟡 | README done; Devpost write-up + video not started |

**Status at Sat ~8:55pm:** all phases 0–5 are written, typecheck clean, `npm run build` clean. Nothing has been clicked in a real Chrome yet (no browser automation available on this machine — disk is nearly full, Playwright couldn't install). First team test pass is the next step; expect a round of fixes.

## Feature checklist

### Core (never cut)
- ✅ Floating widget in Shadow DOM, draggable, position remembered, never blocks clicks when collapsed
- ✅ Collapsed state: character + timer ring; click to expand
- ✅ Sizes S/M/L; hide on this site; disable (with guilt-trip line mid-session)
- ✅ Widget pages: Home · Study Table · Ask · Quotes · Break Tavern (tavern locked during focus)
- ✅ Onboarding (character, name, topic, method, strictness, sites, screen opt-in)
- ✅ Session timer on `chrome.alarms` + storage; synced across tabs; widget backstop for demo-second phases
- ✅ Cinderella clock with strike animation at phase change
- ✅ Mood machine Happy→Suspicious→Annoyed→FURIOUS→LOCKDOWN with strictness curves, per-character lines
- ✅ Lockdown overlay (storm-in, shake), appears on every tab until solved
- ✅ Challenges: riddle (AI or curated), study quiz (AI from topic, curated fallback), oath (backwards on Wolf), friend challenge
- ✅ Safety valve: hold Esc 5s → logged, pet sulks
- ✅ Glass-slipper unlock burst
- ✅ Gemini screen check → `{on_task, confidence, activity, roast_hook}`; 👁️ indicator; opt-in; sensitive-site skip; never stored
- ✅ Gemini roasts referencing `roast_hook`
- ✅ Ask page with "👁️ look at my screen" (screenshot attached to the question)
- ✅ Demo Mode: timers in seconds, ~30s climb to lockdown, 5s screen checks, fake friends, mood slider, force-lockdown buttons
- ✅ Provider layer: `TextProvider` interface, `gemini.ts`, offline curated, fallback chain, provider badge, Gemini/offline toggle in dev panel, self-test button

### Social (Phases 4–5) — written, pending Firebase config + testing
- 🟡 Anonymous account + display name + 6-char friend code (`users/`, `codes/`)
- 🟡 Friends add/accept (`requests/`), presence heartbeat every 30s, Study Table live (`in` query on friend uids)
- 🟡 Nudge (`nudges/`), send challenge (AI-generated or own; `challenges/`) → delivered into the friend's next lockdown
- 🟡 Group Study Room: room codes, shared chat, host-generated AI replies, shared flashcards + quiz, provider badge
- 🟡 Break Tavern: Spellbound race (shared word, 6 guesses, opponent tiles hidden until the end), stranger queue + transaction match, friend invites, chat, AI icebreaker, add friend; bot stranger after 6s in Demo Mode / instantly in local mode
- ✅ Local mode (no Firebase): demo friends, bot opponent, solo room with the AI — the demo works offline

### Pre-cuts agreed (Q18) — do only if ahead
- ⛔ Drag-handle resize (S/M/L kept)
- ⛔ "Hide for N minutes" (hide-on-site + disable kept)
- 🟡 AI quotes: curated list + optional "Conjure one" button (kept, cheap)
- ⛔ Friend-challenge pass/fail notification

## Decisions
- **WXT** over CRXJS (HMR, manifest generation, `createShadowRootUi`).
- **No Tailwind / Framer Motion** (deviation from plan): Tailwind v4 relies on `@property` rules that Chrome ignores inside shadow roots, and we didn't want to debug that at 9pm. Hand-written token CSS (`src/ui/theme.css`) + CSS keyframes cover everything. Fewer deps, no surprises.
- **Gemini models** confirmed from official docs on 2026-10-24: `gemini-3.8-flash` (vision, quality) and `gemini-3.5-flash-lite` (cheap text classification). Configurable in `.env`.
- **Keys** are baked into the local unpacked build from `.env` (gitignored). No proxy.
- **Fonts** Pirata One + Nunito bundled (OFL) and injected into the host document (Chrome ignores `@font-face` inside shadow roots).
- **Art pipeline**: `public/assets/characters/<id>/meta.json` has `hasArt:false`; drop 7 PNGs + flip to `true` to replace the SVG placeholders. Spec in each `meta.json`.
- **Lockdown scope**: every tab (state lives in storage), so new tabs don't escape it.
- **Screen checks**: 60s normal / 5s demo; skipped on allowlisted sites (quota) and sensitive sites.

## Fixed after first test pass (Sat 11pm)
- Social backend never started: offscreen documents can't use `chrome.storage`. Storage now goes through the service worker (`store:get`/`store:set`, changes forwarded as `store:changed`).
- Widget vanishing on tabs: re-injected into open tabs on install/update (`scripting`), anchored to `<html>` instead of `<body>`, re-attached if a page removes it, and key presses no longer leak to page shortcuts.
- Page-flip animation replaced with a short fade.
- Duck had a bill and a drawn mouth; the bill is now the mouth and changes with mood.

## Known bugs / caveats
- `chrome.alarms` minimum granularity is 30s; demo-second phases rely on the widget backstop (works whenever a tab with the widget is visible).
- Idle detection only pauses escalation (no de-escalation while idle).
- Mood doesn't evaluate while a `chrome://` page is focused (no content script there) — by design.
- Pre-Phase-4: Study Table shows demo friends only when Demo Mode is on; Tavern is a placeholder.
