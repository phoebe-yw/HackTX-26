import { useEffect, useRef, useState } from 'react';
import type { SessionState, Settings } from '@/core/types';
import { social } from '@/social/client';
import { SK, type Friend, type GameState, type Me, type QueueState } from '@/social/types';
import { CharacterArt } from '../../components/CharacterArt';
import { ProviderBadge } from '../../components/ProviderBadge';
import { useSessionStored } from '../../hooks';

export function TavernPage({ session, settings }: { settings: Settings; session: SessionState }) {
  const me = useSessionStored<Me | null>(SK.me, null);
  const game = useSessionStored<GameState | null>(SK.game, null);
  const queue = useSessionStored<QueueState>(SK.queue, { status: 'idle', since: 0 });
  const friends = useSessionStored<Friend[]>(SK.friends, []);
  const unlocked = session.status !== 'focus' || settings.demoMode;

  useEffect(() => {
    void social({ cmd: 'ping' }).catch(() => {});
  }, []);

  if (!unlocked) {
    return (
      <div className="col">
        <div className="display" style={{ fontSize: 18 }}>🍻 The Break Tavern</div>
        <div className="empty">The tavern doors are barred until break time. Finish your focus block and the keeper will let you in.</div>
      </div>
    );
  }

  if (game && me) return <Spellbound game={game} me={me} />;

  return (
    <div className="col">
      <div className="display" style={{ fontSize: 18 }}>🍻 The Break Tavern</div>
      <div className="small muted">
        <b>Spellbound</b> — a fairytale word race. Same secret 5-letter word, six guesses each, first to break the spell wins.
      </div>
      {queue.status === 'waiting' ? (
        <div className="parchment col center" style={{ padding: 14 }}>
          <div className="display loading-dots" style={{ fontSize: 20 }}>{queue.message ?? 'Searching the tavern'}</div>
          <div className="small muted">Looking for another scholar on break…</div>
          <button className="btn sm" onClick={() => social({ cmd: 'cancelFind' })}>Cancel</button>
        </div>
      ) : (
        <button className="btn primary" onClick={() => social({ cmd: 'findStranger' })}>🔮 Find someone to play with</button>
      )}
      {queue.status === 'matched' && queue.message && <div className="small muted center">{queue.message}</div>}
      <div className="divider" />
      <div className="small"><b>Or challenge a friend</b></div>
      {friends.length === 0 && <div className="small muted">No friends at the table yet.</div>}
      {friends.map((f) => (
        <div className="friend-row" key={f.uid}>
          <CharacterArt id={f.characterId} pose="happy" size={28} />
          <div style={{ flex: 1 }}><b>{f.name}</b> <span className="small muted">{f.status === 'break' ? '☕ on break' : f.status === 'offline' ? '💤 away' : '🟢 studying'}</span></div>
          <button className="btn sm" onClick={() => social({ cmd: 'inviteFriendToGame', uid: f.uid })}>🎲 Invite</button>
        </div>
      ))}
    </div>
  );
}

const KEYS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

function Spellbound({ game, me }: { game: GameState; me: Me }) {
  const mine = game.players.find((p) => p.uid === me.uid) ?? game.players[0];
  const theirs = game.players.find((p) => p.uid !== me.uid) ?? game.players[1];
  const [input, setInput] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [chat, setChat] = useState('');
  const [tab, setTab] = useState<'board' | 'chat'>('board');
  const [added, setAdded] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const done = game.status === 'finished';
  const iWon = game.winnerUid === me.uid;

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [game.chat.length, tab]);

  async function submit() {
    const w = input.trim().toLowerCase();
    if (w.length !== 5) return;
    const r = await social<{ ok: boolean; message?: string }>({ cmd: 'guess', word: w });
    if (!r.ok) setErr(r.message ?? 'Hmm.');
    else {
      setErr(null);
      setInput('');
    }
  }

  // letter status for keyboard
  const letterState: Record<string, 'g' | 'y' | 'x'> = {};
  for (const g of mine.guesses) g.marks.forEach((m, i) => {
    const ch = g.word[i];
    if (m === 'g' || (m === 'y' && letterState[ch] !== 'g') || (!letterState[ch] && m === 'x')) letterState[ch] = m;
  });

  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="row">
        <span className="display" style={{ fontSize: 18 }}>🔮 Spellbound</span>
        <span className="spacer" />
        <button className={`btn sm ${tab === 'board' ? 'primary' : ''}`} onClick={() => setTab('board')}>Board</button>
        <button className={`btn sm ${tab === 'chat' ? 'primary' : ''}`} onClick={() => setTab('chat')}>Chat {game.chat.length ? `(${game.chat.length})` : ''}</button>
        <button className="btn ghost icon sm" title="Leave" onClick={() => social({ cmd: 'leaveGame' })}>✕</button>
      </div>

      {game.icebreaker && (
        <div className="bubble" style={{ maxWidth: '100%', fontSize: 12 }}>
          🧊 {game.icebreaker}
          <div style={{ marginTop: 4 }}><ProviderBadge provider={game.icebreakerProvider} prefix="icebreaker" /></div>
        </div>
      )}

      {tab === 'board' && (
        <>
          <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Board title={`You`} characterId={mine.characterId} guesses={mine.guesses} reveal />
            <Board title={theirs.name} characterId={theirs.characterId} guesses={theirs.guesses} reveal={done} />
          </div>
          {done ? (
            <div className="parchment col center" style={{ padding: 10 }}>
              <div className="display" style={{ fontSize: 22 }}>{iWon ? '✨ You broke the spell!' : game.winnerUid ? `${theirs.name} broke the spell first.` : 'The spell held. A draw.'}</div>
              <div className="small">The word was <b style={{ letterSpacing: 2 }}>{game.word.toUpperCase()}</b></div>
              <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                {!game.opponentIsFriend && !added && (
                  <button className="btn primary sm" onClick={async () => { const r = await social<{ ok: boolean; message: string }>({ cmd: 'addFriendFromGame' }); setAdded(r.message); }}>➕ Add {theirs.name} as a friend</button>
                )}
                <button className="btn sm" onClick={() => social({ cmd: 'leaveGame' })}>Back to the tavern</button>
              </div>
              {added && <div className="small muted">{added}</div>}
            </div>
          ) : (
            <>
              <div className="row">
                <input
                  className="input"
                  value={input}
                  maxLength={5}
                  placeholder={mine.solvedAt !== null ? 'Waiting for your rival…' : '5-letter word'}
                  disabled={mine.solvedAt !== null || mine.guesses.length >= 6}
                  onChange={(e) => setInput(e.target.value.replace(/[^a-zA-Z]/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  style={{ letterSpacing: 4, textTransform: 'uppercase', fontWeight: 800 }}
                  autoFocus
                />
                <button className="btn primary" onClick={submit} disabled={input.length !== 5}>Cast</button>
              </div>
              {err && <div className="small" style={{ color: 'var(--crimson)' }}>{err}</div>}
              <div className="col" style={{ gap: 3, alignItems: 'center' }}>
                {KEYS.map((row) => (
                  <div key={row} className="row" style={{ gap: 3 }}>
                    {row.split('').map((k) => (
                      <button key={k} className="btn sm" style={{ padding: '3px 0', width: 24, fontSize: 11, background: letterState[k] === 'g' ? '#9ccb8c' : letterState[k] === 'y' ? '#f0d78a' : letterState[k] === 'x' ? '#d8d2c0' : undefined }} onClick={() => input.length < 5 && setInput(input + k)}>
                        {k.toUpperCase()}
                      </button>
                    ))}
                    {row === 'zxcvbnm' && <button className="btn sm" style={{ padding: '3px 6px', fontSize: 11 }} onClick={() => setInput(input.slice(0, -1))}>⌫</button>}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'chat' && (
        <div className="chat" style={{ height: 300 }}>
          <div className="chat-log" ref={logRef}>
            {game.chat.length === 0 && <div className="empty">Say hello to {theirs.name}.</div>}
            {game.chat.map((m) => (
              <div key={m.id} className={`msg ${m.uid === me.uid ? 'user' : 'pet'}`}>
                {m.uid !== me.uid && <b>{m.name}: </b>}
                {m.text}
              </div>
            ))}
          </div>
          <div className="chat-input">
            <textarea className="textarea" rows={1} value={chat} placeholder="Say something…" onChange={(e) => setChat(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (chat.trim()) { void social({ cmd: 'gameChat', text: chat }); setChat(''); } } }} />
            <button className="btn primary" disabled={!chat.trim()} onClick={() => { void social({ cmd: 'gameChat', text: chat }); setChat(''); }}>➤</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Board({ title, characterId, guesses, reveal }: { title: string; characterId: GameState['players'][0]['characterId']; guesses: GameState['players'][0]['guesses']; reveal: boolean }) {
  const rows = Array.from({ length: 6 }, (_, i) => guesses[i]);
  return (
    <div className="col" style={{ gap: 4, alignItems: 'center' }}>
      <div className="row" style={{ gap: 4 }}>
        <CharacterArt id={characterId} pose="happy" size={20} />
        <span className="small" style={{ fontWeight: 800, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      </div>
      {rows.map((g, i) => (
        <div key={i} className="row" style={{ gap: 3 }}>
          {Array.from({ length: 5 }, (_, j) => {
            const m = g?.marks[j];
            const bg = !g ? 'transparent' : m === 'g' ? '#9ccb8c' : m === 'y' ? '#f0d78a' : '#d8d2c0';
            return (
              <div key={j} style={{ width: 22, height: 22, border: '1.5px solid var(--ink)', borderRadius: 4, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>
                {g && reveal ? g.word[j] : g ? '' : ''}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
