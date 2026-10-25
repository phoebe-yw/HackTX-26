# SWITCH_TO_META.md — flipping `socialAI` from Gemini to Meta Muse

Target: Sunday ~8:00am. Budget: 10 minutes if Muse's API is a normal chat endpoint. Rollback: 1 line.
If Meta isn't green by **9:30am**, roll back and demo with Gemini (the provider badge will say so honestly).

Nothing in feature code changes. The only files involved:

- `.env` — key, base URL, model, and the `WXT_SOCIAL_AI_PROVIDER` switch
- `src/ai/providers/meta.ts` — the single function `museChat()` (currently a stub that throws)

## 0. Before you start
- [ ] Have Meta's docs open: the chat/completions endpoint URL, auth header format, request body shape, response shape, model id for **Muse Spark**.
- [ ] Have the API key.
- [ ] Note the current state: in Chrome → extension options → **Demo & dev** → "Test all socialAI functions" → everything should say `gemini`.

## 1. Paste the key + config
In `.env` (never commit this file):
```
WXT_META_API_KEY=<paste key>
WXT_META_BASE_URL=<from docs, e.g. https://api.meta.example/v1>
WXT_META_MODEL=<Muse Spark model id from docs>
WXT_SOCIAL_AI_PROVIDER=meta
WXT_VISION_AI_PROVIDER=gemini     # leave alone — the eyes stay Gemini
```

## 2. Implement `museChat()` in `src/ai/providers/meta.ts`
Replace the body of `museChat` with the real call. Our `AiMessage` shape is `{ role: 'system'|'user'|'assistant', content: string | (string | {image})[] }`.
Social features never send images, so `content` can be flattened to text:

```ts
async function museChat(messages: AiMessage[], options: ChatOptions = {}): Promise<string> {
  if (!configured()) throw new NotConfiguredError('meta');
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
  try {
    const res = await fetch(`${BASE_URL}/<ENDPOINT FROM DOCS>`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` }, // verify header name in docs
      body: JSON.stringify({
        model: MODEL,
        messages: messages.map((m) => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : m.content.map((p) => (typeof p === 'string' ? p : '')).join('\n'),
        })),
        temperature: options.temperature ?? 0.8,
        max_tokens: options.maxTokens ?? 800, // verify field name in docs
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new ProviderError('meta', `${res.status} ${await res.text()}`, res.status);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? data?.output_text ?? ''; // adjust to the real response shape
    if (!text) throw new ProviderError('meta', 'empty response');
    return text;
  } finally {
    clearTimeout(t);
  }
}
```
JSON mode: not required. `metaProvider.json()` already appends a JSON-schema instruction to the prompt and validates with zod, so any chat model works. If Muse has a native JSON/structured-output option, you may add it, but don't block on it.

## 3. Rebuild + reload
```
npm run build
```
Chrome → `chrome://extensions` → Once Upon a Focus → **Reload**. (With `npm run dev` running, WXT reloads automatically.)

## 4. Test every `socialAI` function (one button)
Options page → **Demo & dev** → **Ping meta** (should return a greeting), then **Test all socialAI functions**.
Expected: each row `PASS` with `answered by = meta`:

| function | used by |
|---|---|
| groupReply | Group Study Room chat |
| generateFlashcards | Group Study Room → 🃏 |
| generateQuiz | lockdown Study Quiz, Group Study Room → ❓ |
| riddle | lockdown riddle |
| icebreaker | Break Tavern match |
| generateChallenge | Study Table → ⚔️ "Let the AI write one" |
| quote | Quotes page → "Conjure one" |

Any row that says `FALLBACK` with provider `gemini` means Meta threw and the chain fell back (check the service worker console: `chrome://extensions` → service worker → Console; look for `[ai:<fn>] meta failed → next`).

Then do the live checks that the judges will see — badges should read **✨ Powered by Meta Muse**:
- [ ] Ask → Group Study Room → open a room → send a message → Spirit answers; → 🃏 Conjure flashcards
- [ ] Tavern → Find someone → icebreaker badge
- [ ] Options → Demo & dev → Force lockdown: quiz → trial badge

You can also flip providers **live without rebuilding**: Demo & dev → socialAI → `meta` / `gemini`.

## 5. Rollback (1 line)
`.env`: `WXT_SOCIAL_AI_PROVIDER=gemini` → `npm run build` → reload. Or, without rebuilding: Demo & dev → socialAI → **gemini**.
Fallback is also automatic: if Meta fails at demo time, the chain goes Meta → Gemini → curated, and the badge tells the truth.

## Notes
- Vision stays on Gemini on purpose: that's the Gemini-track feature. The dev panel disables non-Gemini vision buttons.
- Prompts live in `src/ai/prompts/index.ts` and are plain text — nothing provider-specific.
- Every provider answer is logged: `[ai:<fn>] answered by <provider> in <ms>ms`.
