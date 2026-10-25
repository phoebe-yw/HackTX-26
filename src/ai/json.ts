import { z, type ZodType } from 'zod';

/** Pull JSON out of a model reply that may include code fences or prose. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    // Find the first balanced {...} or [...] block
    const start = candidate.search(/[[{]/);
    if (start === -1) throw new Error('No JSON found in response');
    const open = candidate[start];
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    for (let i = start; i < candidate.length; i++) {
      const ch = candidate[i];
      if (ch === open) depth++;
      else if (ch === close) depth--;
      if (depth === 0) {
        return JSON.parse(candidate.slice(start, i + 1));
      }
    }
    throw new Error('Unbalanced JSON in response');
  }
}

export function parseWith<T>(schema: ZodType<T>, text: string): T {
  const raw = extractJson(text);
  return schema.parse(raw);
}

export function schemaToJsonSchema(schema: ZodType): Record<string, unknown> {
  // zod v4 ships a JSON schema exporter
  const js = z.toJSONSchema(schema, { target: 'draft-7' }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

export function schemaInstruction(schema: ZodType): string {
  return `Respond with ONLY valid JSON (no markdown, no commentary) matching this JSON Schema:\n${JSON.stringify(
    schemaToJsonSchema(schema),
  )}`;
}
