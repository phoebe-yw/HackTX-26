import { useEffect, useRef, useState } from 'react';
import type { Settings } from '@/core/types';
import { social } from '@/social/client';
import { SK, type Me, type RoomState } from '@/social/types';
import { CharacterArt } from '../../components/CharacterArt';
import { Markdown } from '../../components/Markdown';
import { ProviderBadge } from '../../components/ProviderBadge';
import { useSessionStored } from '../../hooks';

export function RoomPanel({ settings }: { settings: Settings }) {
  const me = useSessionStored<Me | null>(SK.me, null);
  const room = useSessionStored<RoomState | null>(SK.room, null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [view, setView] = useState<'chat' | 'cards' | 'quiz'>('chat');
  const [notes, setNotes] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void social({ cmd: 'ping' }).catch(() => {});
  }, []);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [room?.messages.length, room?.aiBusy, view]);

  if (!room) {
    return (
      <div className="col">
        <div className="small muted">
          Invite friends into the <b>same</b> AI chat. Everyone sees every message; the Study Spirit answers the group and
          can conjure shared flashcards and quizzes from your topic or pasted notes.
        </div>
        <button className="btn primary" onClick={() => social({ cmd: 'createRoom' })}>🕯️ Open a study room</button>
        <div className="row">
          <input className="input" placeholder="Room code" value={code} maxLength={6} style={{ fontFamily: 'monospace', letterSpacing: 2 }} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button className="btn sm" onClick={async () => { try { const r = await social<{ ok: boolean; message: string }>({ cmd: 'joinRoom', code }); setMsg(r.message); } catch (e) { setMsg(String(e)); } }}>Join</button>
        </div>
        {msg && <div className="small muted">{msg}</div>}
        {me?.mode === 'local' && <div className="small muted">Local mode: rooms are just you + the Spirit{settings.demoMode ? ' (+ demo friends)' : ''}. Connect Firebase for real friends.</div>}
      </div>
    );
  }

  const lastProvider = [...room.messages].reverse().find((m) => m.isAI)?.provider;

  return (
    <div className="chat" style={{ height: 330 }}>
      <div className="row" style={{ marginBottom: 4, flexWrap: 'wrap' }}>
        <span className="chip" title="Share to invite" style={{ fontFamily: 'monospace', letterSpacing: 2 }}>{room.code}</span>
        <div className="row" style={{ gap: 0 }}>
          {room.members.slice(0, 5).map((m) => (
            <span key={m.uid} title={m.name} style={{ marginLeft: -6 }}><CharacterArt id={m.characterId} pose="happy" size={22} /></span>
          ))}
          <span className="small muted" style={{ marginLeft: 6 }}>{room.members.length}</span>
        </div>
        <span className="spacer" />
        <button className={`btn sm ${view === 'chat' ? 'primary' : ''}`} onClick={() => setView('chat')}>💬</button>
        <button className={`btn sm ${view === 'cards' ? 'primary' : ''}`} onClick={() => setView('cards')}>🃏 {room.flashcards.length || ''}</button>
        <button className={`btn sm ${view === 'quiz' ? 'primary' : ''}`} onClick={() => setView('quiz')}>❓</button>
        <button className="btn ghost icon sm" title="Leave room" onClick={() => social({ cmd: 'leaveRoom' })}>✕</button>
      </div>

      {view === 'chat' && (
        <>
          <div className="chat-log" ref={logRef}>
            {room.messages.length === 0 && <div className="empty">Room “{room.topic}” is open. Ask the group — or the Spirit — anything.</div>}
            {room.messages.map((m) => (
              <div key={m.id} className={`msg ${m.uid === me?.uid ? 'user' : 'pet'}`}>
                {m.isAI ? (
                  <Markdown text={m.text} lead={<b>✨ Study Spirit: </b>} />
                ) : (
                  <>
                    {m.uid !== me?.uid && <b>{m.name}: </b>}
                    {m.text}
                  </>
                )}
                {m.isAI && <span className="meta"><ProviderBadge provider={m.provider} /></span>}
              </div>
            ))}
            {room.aiBusy && <div className="msg system">✨ the Spirit is thinking…</div>}
          </div>
          <div className="chat-input">
            <textarea className="textarea" rows={1} value={text} placeholder="Ask the room…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (text.trim()) { void social({ cmd: 'roomMessage', text }); setText(''); } } }} />
            <button className="btn primary" disabled={!text.trim()} onClick={() => { void social({ cmd: 'roomMessage', text }); setText(''); }}>➤</button>
          </div>
        </>
      )}

      {view === 'cards' && (
        <div className="col" style={{ flex: 1, overflow: 'auto' }}>
          {room.flashcards.length === 0 ? (
            <>
              <div className="small muted">Shared flashcards for <b>{room.topic}</b>. Paste notes (optional) and conjure.</div>
              <textarea className="textarea" placeholder="Paste notes here (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <button className="btn primary sm" disabled={room.aiBusy} onClick={() => social({ cmd: 'roomFlashcards', notes })}>{room.aiBusy ? 'conjuring…' : '✨ Conjure flashcards'}</button>
            </>
          ) : (
            <>
              <div className="row"><ProviderBadge provider={room.flashcardsProvider} prefix="cards" /><span className="spacer" /><button className="btn sm" disabled={room.aiBusy} onClick={() => social({ cmd: 'roomFlashcards', notes })}>↻</button></div>
              <Flashcards cards={room.flashcards} />
            </>
          )}
        </div>
      )}

      {view === 'quiz' && (
        <div className="col" style={{ flex: 1, overflow: 'auto' }}>
          {room.quiz.length === 0 ? (
            <>
              <div className="small muted">A quick group quiz on <b>{room.topic}</b>.</div>
              <button className="btn primary sm" disabled={room.aiBusy} onClick={() => social({ cmd: 'roomQuiz' })}>{room.aiBusy ? 'conjuring…' : '✨ Conjure a quiz'}</button>
            </>
          ) : (
            <>
              <div className="row"><ProviderBadge provider={room.quizProvider} prefix="quiz" /><span className="spacer" /><button className="btn sm" disabled={room.aiBusy} onClick={() => social({ cmd: 'roomQuiz' })}>↻</button></div>
              <Quiz questions={room.quiz} />
            </>
          )}
        </div>
      )}
      {lastProvider && view === 'chat' && <div className="center" style={{ marginTop: 4 }}><ProviderBadge provider={lastProvider} prefix="room" /></div>}
    </div>
  );
}

function Flashcards({ cards }: { cards: RoomState['flashcards'] }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const c = cards[i % cards.length];
  return (
    <div className="col" style={{ alignItems: 'center' }}>
      <div className="parchment quote-card anim-page" key={`${i}-${flipped}`} style={{ width: '100%', cursor: 'pointer', minHeight: 120 }} onClick={() => setFlipped((f) => !f)}>
        <div>
          <div className="small muted" style={{ marginBottom: 6 }}>{flipped ? 'answer' : 'tap to flip'} · {i + 1}/{cards.length}</div>
          {flipped ? c.back : c.front}
        </div>
      </div>
      <div className="row">
        <button className="btn sm" onClick={() => { setI((i - 1 + cards.length) % cards.length); setFlipped(false); }}>←</button>
        <button className="btn sm" onClick={() => { setI((i + 1) % cards.length); setFlipped(false); }}>→</button>
      </div>
    </div>
  );
}

function Quiz({ questions }: { questions: RoomState['quiz'] }) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  return (
    <div className="col">
      {questions.map((q, qi) => (
        <div key={qi} className="col" style={{ gap: 4 }}>
          <div style={{ fontWeight: 700 }}>{qi + 1}. {q.question}</div>
          {q.options.map((o, oi) => {
            const p = picked[qi];
            const cls = p === undefined ? '' : oi === q.correctIndex ? 'correct' : p === oi ? 'wrong' : '';
            return (
              <button key={oi} className={`btn sm ${cls}`} style={{ justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left', background: cls === 'correct' ? '#dfe9d9' : cls === 'wrong' ? '#f1d4d9' : undefined }} onClick={() => setPicked((x) => ({ ...x, [qi]: oi }))}>
                {String.fromCharCode(65 + oi)}. {o}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
