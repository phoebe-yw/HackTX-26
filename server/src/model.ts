// Chat and image checks use Gemini's OpenAI-compatible endpoint.
// https://ai.google.dev/gemini-api/docs/openai
// gemini-3.8-flash is often overloaded, so the egg check starts on the lite model
// and walks this list when a model times out or says it is too busy.

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const FALLBACKS = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.1-flash-lite"];

export function modelId() {
  return process.env.MODEL_ID || FALLBACKS[0];
}

function modelOrder() {
  const preferred = modelId();
  return [preferred, ...FALLBACKS.filter((id) => id !== preferred)];
}

export function modelConfigured() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.MODEL_API_KEY);
}

export type Source = { title: string; link: string; snippet: string };

type ChatContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

async function complete(messages: Array<{ role: "system" | "user"; content: ChatContent }>, timeoutMs: number) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.MODEL_API_KEY;
  if (!apiKey) throw new Error("missing_key");
  let lastError = "model_error";
  for (const model of modelOrder()) {
    try {
      return await completeOnce(apiKey, model, messages, timeoutMs);
    } catch (error) {
      lastError = error instanceof Error ? error.message : "model_error";
      if (!isBusy(lastError)) throw error;
    }
  }
  throw new Error(lastError);
}

function isBusy(message: string) {
  return (
    message.startsWith("model_503") ||
    message.startsWith("model_429") ||
    message.startsWith("model_404") ||
    message === "empty_model" ||
    message.includes("aborted")
  );
}

async function completeOnce(
  apiKey: string,
  model: string,
  messages: Array<{ role: "system" | "user"; content: ChatContent }>,
  timeoutMs: number,
  reasoning = true,
) {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      ...(reasoning ? { reasoning_effort: "low" } : {}),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  if (!response.ok) {
    if (reasoning && response.status === 400 && /reasoning|thinking/i.test(text)) {
      return completeOnce(apiKey, model, messages, timeoutMs, false);
    }
    throw new Error(`model_${response.status}: ${text.slice(0, 240)}`);
  }
  const data = JSON.parse(text) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = messageText(data.choices?.[0]?.message?.content);
  if (!content) throw new Error("empty_model");
  return content;
}

function messageText(content: string | Array<{ text?: string }> | null | undefined) {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content.map((part) => part.text ?? "").join("").trim();
}

export function parseJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? content;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("bad_json");
  return JSON.parse(raw.slice(start, end + 1));
}

export async function seeImage(jpeg: Buffer, challenge: string) {
  const dataUrl = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  const content = await complete(
    [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              "You are checking one photo for a real-world challenge.",
              `The challenge is: ${challenge}`,
              'Reply with JSON only: {"match": true or false, "line": "one short sentence as Eggward, a cute petty study pet"}.',
              "Set match to true only if that object is clearly, physically present.",
              "A drawing, a screen, or a guess is not enough. If you are unsure, match is false.",
            ].join(" "),
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    12_000,
  );
  const parsed = parseJson(content) as { match?: unknown; line?: unknown };
  if (typeof parsed.match !== "boolean" || typeof parsed.line !== "string" || !parsed.line.trim()) {
    throw new Error("bad_json");
  }
  return { match: parsed.match, line: parsed.line.trim().slice(0, 180) };
}

export async function answerQuestion(question: string, sources: Source[]) {
  const listed = sources
    .map((source, index) => `${index + 1}. ${source.title} — ${source.snippet} — ${source.link}`)
    .join("\n");
  return complete(
    [
      {
        role: "system",
        content:
          "You are Eggward, a cute petty study pet. Answer in under 90 words using only the sources given. If they do not support an answer, say you could not find a source and do not invent one. Do not add citations that are not in the list. End with one short studying joke.",
      },
      {
        role: "user",
        content: `Question: ${question}\n\nSources:\n${listed}`,
      },
    ],
    12_000,
  );
}

export async function makeCards(pageText: string) {
  const content = await complete(
    [
      {
        role: "system",
        content:
          'Turn the page into exactly 3 study flashcards. Reply with JSON only: {"cards":[{"q":"...","a":"..."},{"q":"...","a":"..."},{"q":"...","a":"..."}]}. Use only facts from the page. Keep each side under 30 words. Write like a friend quizzing you, not a textbook.',
      },
      { role: "user", content: pageText },
    ],
    12_000,
  );
  const parsed = parseJson(content) as { cards?: Array<{ q?: unknown; a?: unknown }> };
  const cards = (parsed.cards ?? [])
    .map((card) => ({
      q: typeof card.q === "string" ? card.q.trim() : "",
      a: typeof card.a === "string" ? card.a.trim() : "",
    }))
    .filter((card) => card.q && card.a)
    .slice(0, 3);
  if (cards.length !== 3) throw new Error("bad_json");
  return cards;
}
