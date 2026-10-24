// Confirmed engines: google_scholar and extract.
// https://serpapi.com/google-scholar-api
// https://serpapi.com/extract-api

import type { Source } from "./model.ts";

export function searchConfigured() {
  return Boolean(process.env.SERPAPI_KEY);
}

function scrub(message: string) {
  const key = process.env.SERPAPI_KEY;
  return key ? message.replaceAll(key, "***") : message;
}

async function serp(params: Record<string, string>) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("missing_key");
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("api_key", apiKey);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(scrub(`search_bad_json_${response.status}`));
  }
  if (!response.ok || data.error) {
    const reason = typeof data.error === "string" ? data.error : `search_${response.status}`;
    throw new Error(scrub(reason).slice(0, 240));
  }
  return data;
}

export async function scholar(query: string): Promise<Source[]> {
  const data = await serp({ engine: "google_scholar", q: query, num: "3", hl: "en" });
  const rows = Array.isArray(data.organic_results) ? data.organic_results : [];
  return rows
    .map((row) => {
      const item = row as { title?: unknown; link?: unknown; snippet?: unknown };
      return {
        title: typeof item.title === "string" ? item.title : "",
        link: typeof item.link === "string" ? item.link : "",
        snippet: typeof item.snippet === "string" ? item.snippet : "",
      };
    })
    .filter((item) => item.title && item.link)
    .slice(0, 3);
}

function findMarkdown(value: unknown, depth = 0): string {
  if (depth > 6 || value == null) return "";
  if (typeof value === "string") return value.length > 80 ? value : "";
  if (typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of ["markdown", "md", "content", "text"]) {
    const found = record[key];
    if (typeof found === "string" && found.length > 80) return found;
  }
  for (const nested of Object.values(record)) {
    const found = findMarkdown(nested, depth + 1);
    if (found) return found;
  }
  return "";
}

export async function extractMarkdown(pageUrl: string) {
  const data = await serp({
    engine: "extract",
    url: pageUrl,
    output: "md",
    mode: "scrape",
  });
  return findMarkdown(data).slice(0, 6000);
}
