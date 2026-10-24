# Eggward

A study pet for a shared room. It sits on ordinary Chrome tabs, gets mad when you open a blocked site, and locks that browser until a camera check passes. Friends share one chat. Study answers and flashcards stay empty until API keys exist, on purpose.

## Run it

```powershell
npm install
copy .env.example .env
npm run dev
```

- Companion: http://localhost:5173
- API: http://localhost:3000
- Seed room: `EGG1`, with Maya (host) and Jordan already inside

Load the extension unpacked at `chrome://extensions` → Developer mode → Load unpacked → choose the `extension` folder. The popup asks for a name, a buddy look, then create a room or join one. `EGG1` is already seeded with Maya (host) and Jordan. The pet sits at the bottom left of ordinary tabs. Hide tucks it into a small button; it comes back from that button or from Show buddy. A lock still covers the page when the pet is hidden. The API and phone-page URLs can stay on the defaults under Connection.

`npm run check` runs the server self-check: strike clock, per-person challenge, fail-closed study, fail-closed vision, and host override.

## Keys

Put these in `.env` at the repo root, then restart `npm run dev`. Do not commit the file.

- `GEMINI_API_KEY` from Google AI Studio. The app calls `gemini-3.5-flash-lite` on Gemini's OpenAI-compatible endpoint. Leave this blank and the egg check says it blinked and stays locked.
- `SERPAPI_KEY` from SerpApi. Questions use Google Scholar. Links use the Extract API. Leave this blank and Eggward refuses to invent a citation.

## What a lock actually covers

The extension covers the page, not the desktop, the address bar, or other apps. Localhost is left open so the camera page is usable. Disabling the extension removes the lock. The host has a labeled override for when a model key is missing or a demo gets stuck.

Phone and iPad use the same website. iPhone camera access needs HTTPS, so a laptop demo can use the companion tab directly.
