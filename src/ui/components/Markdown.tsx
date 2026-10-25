// Minimal Markdown for AI replies: **bold**, *italic*, `code`, ``` blocks, lists, headings.
// Builds React nodes (no innerHTML), so model output can't inject markup.
import type { ReactNode } from 'react';

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*|__[^_\n]+?__)|(\*[^*\s][^*\n]*?\*|(?<!\w)_[^_\s][^_\n]*?_(?!\w))/g;

function inline(text: string, keyBase = ''): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const k = `${keyBase}${i++}`;
    if (m[1]) out.push(<code key={k}>{m[1].slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k}>{inline(m[2].slice(2, -2), `${k}.`)}</strong>);
    else out.push(<em key={k}>{inline(m[3].slice(1, -1), `${k}.`)}</em>);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { kind: 'p' | 'h'; text: string; gap: boolean }
  | { kind: 'li'; marker: string; text: string; gap: boolean }
  | { kind: 'code'; text: string; gap: boolean };

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  let code: string[] | null = null;
  let gap = false;
  for (const line of text.replace(/\r\n/g, '\n').trim().split('\n')) {
    if (/^\s*```/.test(line)) {
      if (code) {
        blocks.push({ kind: 'code', text: code.join('\n'), gap });
        code = null;
        gap = false;
      } else code = [];
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    if (!line.trim()) {
      gap = blocks.length > 0;
      continue;
    }
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (heading) blocks.push({ kind: 'h', text: heading[1], gap });
    else if (bullet) blocks.push({ kind: 'li', marker: '•', text: bullet[1], gap });
    else if (numbered) blocks.push({ kind: 'li', marker: `${numbered[1]}.`, text: numbered[2], gap });
    else blocks.push({ kind: 'p', text: line, gap });
    gap = false;
  }
  if (code) blocks.push({ kind: 'code', text: code.join('\n'), gap });
  return blocks;
}

/** `lead` (e.g. a sender name) is placed inline before the first paragraph. */
export function Markdown({ text, lead }: { text: string; lead?: ReactNode }) {
  const blocks = parse(text);
  const leadInline = blocks[0]?.kind === 'p' || blocks[0]?.kind === 'h';
  return (
    <div className="md">
      {lead && !leadInline && <div>{lead}</div>}
      {blocks.map((b, n) => {
        const cls = b.gap ? 'md-gap' : undefined;
        const before = n === 0 && leadInline ? lead : null;
        if (b.kind === 'code') return <pre key={n} className={cls}>{b.text}</pre>;
        if (b.kind === 'li')
          return (
            <div key={n} className={`md-li${b.gap ? ' md-gap' : ''}`}>
              <span>{b.marker}</span>
              <span>{inline(b.text)}</span>
            </div>
          );
        if (b.kind === 'h') return <div key={n} className={cls}>{before}<strong>{inline(b.text)}</strong></div>;
        return <div key={n} className={cls}>{before}{inline(b.text)}</div>;
      })}
    </div>
  );
}
