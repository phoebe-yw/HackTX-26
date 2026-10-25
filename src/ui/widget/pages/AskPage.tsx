import { useEffect, useRef, useState } from 'react';
import { send } from '@/core/messaging';
import type { Settings } from '@/core/types';
import { useStored } from '../../hooks';
import { Markdown } from '../../components/Markdown';
import { ProviderBadge } from '../../components/ProviderBadge';
import { RoomPanel } from './RoomPanel';

export function AskPage({ settings }: { settings: Settings }) {
  const [mode, setMode] = useState<'pet' | 'room'>('pet');
  return (
    <div className="col" style={{ gap: 4 }}>
      <div className="row">
        <button className={`btn sm ${mode === 'pet' ? 'primary' : ''}`} onClick={() => setMode('pet')}>🪞 Ask {settings.petName}</button>
        <button className={`btn sm ${mode === 'room' ? 'primary' : ''}`} onClick={() => setMode('room')}>🕯️ Group Study Room</button>
      </div>
      {mode === 'pet' ? <PetChat settings={settings} /> : <RoomPanel settings={settings} />}
    </div>
  );
}

function PetChat({ settings }: { settings: Settings }) {
  const [history] = useStored('chatHistory');
  const [text, setText] = useState('');
  const [withScreen, setWithScreen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [history?.length, busy]);

  async function submit() {
    const q = text.trim();
    if (!q || busy) return;
    setText('');
    setBusy(true);
    setError(null);
    try {
      await send('ai:ask', { text: q, withScreen });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat" style={{ height: 300 }}>
      <div className="row" style={{ marginBottom: 4 }}>
        <span className="spacer" />
        <button
          className={`toggle ${withScreen ? 'on' : ''}`}
          onClick={() => setWithScreen((v) => !v)}
          title="Attach a screenshot of this tab to your question (Gemini vision)"
        >
          👁️ look at my screen
        </button>
        {history && history.length > 0 && (
          <button className="btn ghost icon sm" title="Clear" onClick={() => send('ai:clearChat', {})}>
            🧹
          </button>
        )}
      </div>
      <div className="chat-log" ref={logRef}>
        {(!history || history.length === 0) && (
          <div className="empty">
            Ask me anything about what you're studying. Toggle <b>👁️ look at my screen</b> and I'll read the page you're
            on — diagrams, errors, that paragraph you've reread four times.
          </div>
        )}
        {history?.map((m) => (
          <div key={m.id} className={`msg ${m.role}`}>
            {m.role === 'pet' ? <Markdown text={m.text} /> : m.text}
            {m.role === 'pet' && (
              <span className="meta">
                <ProviderBadge provider={m.provider} prefix={m.withScreen ? '👁️ saw your screen' : undefined} />
              </span>
            )}
            {m.role === 'user' && m.withScreen && <span className="meta">📎 with screenshot</span>}
          </div>
        ))}
        {busy && <div className="msg system">{withScreen ? '👁️ peering at your screen…' : 'thinking…'}</div>}
        {error && <div className="msg system" style={{ color: 'var(--crimson)' }}>{error}</div>}
      </div>
      <div className="chat-input">
        <textarea
          className="textarea"
          placeholder={withScreen ? 'e.g. explain this diagram' : 'e.g. quiz me on chapter 7'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={1}
        />
        <button className="btn primary" disabled={busy || !text.trim()} onClick={submit}>
          ➤
        </button>
      </div>
    </div>
  );
}
