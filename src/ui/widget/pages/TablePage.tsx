import { useEffect, useState } from 'react';
import type { Settings } from '@/core/types';
import { fmtDuration } from '@/core/util';
import { CHARACTERS } from '@/data/characters';
import { social } from '@/social/client';
import { SK, type Friend, type FriendRequest, type GameInvite, type Me, type Nudge } from '@/social/types';
import { CharacterArt } from '../../components/CharacterArt';
import { ProviderBadge } from '../../components/ProviderBadge';
import { useSessionStored } from '../../hooks';

const STATUS: Record<Friend['status'], string> = {
  focusing: '🟢 focusing',
  break: '☕ on break',
  distracted: '😵 distracted',
  offline: '💤 away',
};

export function TablePage({ settings, onOpenTavern }: { settings: Settings; onOpenTavern: () => void }) {
  const me = useSessionStored<Me | null>(SK.me, null);
  const friends = useSessionStored<Friend[]>(SK.friends, []);
  const requests = useSessionStored<FriendRequest[]>(SK.requests, []);
  const nudges = useSessionStored<Nudge[]>(SK.nudges, []);
  const invites = useSessionStored<GameInvite[]>(SK.invites, []);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [challengeFor, setChallengeFor] = useState<Friend | null>(null);

  // Wake the social backend when the page opens (re-mirrors state into storage.session)
  useEffect(() => {
    void social({ cmd: 'ping' }).catch((e: unknown) => setMsg(e instanceof Error ? e.message : String(e)));
  }, []);

  async function addFriend() {
    if (!code.trim()) return;
    try {
      const r = await social<{ ok: boolean; message: string }>({ cmd: 'addFriendByCode', code });
      setMsg(r.message);
      if (r.ok) setCode('');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  const online = friends.filter((f) => f.status !== 'offline');
  const away = friends.filter((f) => f.status === 'offline');

  return (
    <div className="col">
      <div className="row">
        <span className="display" style={{ fontSize: 18 }}>🪑 The Study Table</span>
        <span className="spacer" />
        {me && <span className={`badge ${me.mode === 'firebase' ? 'live' : 'offline'}`} title={me.error ?? ''}>{me.mode === 'firebase' ? 'live' : 'local'}</span>}
      </div>

      {(!me || me.error) && (
        <div className="small muted">
          {!me ? 'Connecting to the Study Table…' : `Couldn't reach Firebase, using local mode: ${me.error}`}
          {!me && msg && <div>{msg}</div>}
        </div>
      )}

      {me && (
        <div className="parchment" style={{ padding: '8px 10px' }}>
          <div className="row">
            {editingName ? (
              <>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoFocus onKeyDown={(e) => e.key === 'Enter' && (social({ cmd: 'setName', name }), setEditingName(false))} />
                <button className="btn sm primary" onClick={() => { void social({ cmd: 'setName', name }); setEditingName(false); }}>Save</button>
              </>
            ) : (
              <>
                <b>{me.name || 'Nameless scholar'}</b>
                <button className="btn ghost icon sm" title="Change name" onClick={() => { setName(me.name); setEditingName(true); }}>✎</button>
                <span className="spacer" />
                <span className="small muted">your code</span>
                <span className="chip" title="Share this with friends" style={{ fontFamily: 'monospace', letterSpacing: 2 }}>{me.code}</span>
              </>
            )}
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <input className="input" placeholder="Friend's code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && addFriend()} style={{ fontFamily: 'monospace', letterSpacing: 2 }} maxLength={6} />
            <button className="btn sm" onClick={addFriend}>Add</button>
          </div>
          {msg && <div className="small muted" style={{ marginTop: 4 }}>{msg}</div>}
        </div>
      )}

      {requests.length > 0 && (
        <div className="col">
          {requests.map((r) => (
            <div className="friend-row" key={r.id}>
              <CharacterArt id={r.fromCharacter} pose="happy" size={32} />
              <div style={{ flex: 1 }}><b>{r.fromName}</b> <span className="small muted">wants to study with you</span></div>
              <button className="btn sm primary" onClick={() => social({ cmd: 'respondRequest', id: r.id, accept: true })}>✓</button>
              <button className="btn sm" onClick={() => social({ cmd: 'respondRequest', id: r.id, accept: false })}>✕</button>
            </div>
          ))}
        </div>
      )}
      {invites.length > 0 && (
        <div className="col">
          {invites.map((i) => (
            <div className="friend-row" key={i.id}>
              <span>🎲</span>
              <div style={{ flex: 1 }}><b>{i.fromName}</b> <span className="small muted">challenges you to Spellbound</span></div>
              <button className="btn sm primary" onClick={async () => { await social({ cmd: 'acceptInvite', id: i.id }); onOpenTavern(); }}>Play</button>
            </div>
          ))}
        </div>
      )}
      {nudges.map((n) => (
        <div className="bubble" key={n.id} style={{ maxWidth: '100%' }}>
          👋 <b>{n.fromName}</b> nudged you: “Still at it?”
          <button className="btn ghost icon sm" style={{ float: 'right' }} onClick={() => social({ cmd: 'dismissNudge', id: n.id })}>✕</button>
        </div>
      ))}

      {friends.length === 0 && (
        <div className="empty">
          The table is empty. Share your code with a friend, or turn on Demo Mode (settings → Demo & dev) to seat some
          storybook friends.
        </div>
      )}
      {[...online, ...away].map((f) => (
        <div className="friend-row" key={f.uid} style={{ opacity: f.status === 'offline' ? 0.6 : 1 }}>
          <CharacterArt id={f.characterId} pose={f.status === 'distracted' ? 'annoyed' : f.status === 'break' ? 'happy' : f.status === 'offline' ? 'sleeping' : 'idle'} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="name">
              {f.name} <span className="muted small">· {CHARACTERS[f.characterId].name}</span>
              {f.isDemo && <span className="chip bad" style={{ marginLeft: 4, fontSize: 9 }}>demo</span>}
            </div>
            <div className="status">
              {STATUS[f.status]} · {fmtDuration(f.focusMsToday)} today{f.topic ? ` · ${f.topic}` : ''}
            </div>
          </div>
          <button className="btn sm icon" title="Nudge" onClick={() => { void social({ cmd: 'nudge', uid: f.uid }); setMsg(`You nudged ${f.name}.`); }}>👋</button>
          <button className="btn sm icon" title="Send a challenge (shows up in their next lockdown)" onClick={() => setChallengeFor(f)}>⚔️</button>
          <button className="btn sm icon" title="Invite to Spellbound" onClick={async () => { await social({ cmd: 'inviteFriendToGame', uid: f.uid }); onOpenTavern(); }}>🎲</button>
        </div>
      ))}

      {challengeFor && <ChallengeComposer friend={challengeFor} settings={settings} onClose={() => setChallengeFor(null)} />}
    </div>
  );
}

function ChallengeComposer({ friend, onClose }: { friend: Friend; settings: Settings; onClose: () => void }) {
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ prompt: string; provider: string } | null>(null);

  async function sendIt(generate: boolean) {
    setBusy(true);
    try {
      const r = await social<{ prompt: string; provider: string }>({
        cmd: 'sendChallenge',
        uid: friend.uid,
        generate,
        prompt: generate ? undefined : prompt.trim(),
        answers: generate ? undefined : answer.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean),
      });
      setResult(r);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="parchment col" style={{ padding: 10 }}>
      <div className="row">
        <b>⚔️ Challenge {friend.name}</b>
        <span className="spacer" />
        <button className="btn ghost icon sm" onClick={onClose}>✕</button>
      </div>
      {result ? (
        <div className="col">
          <div className="small">Sent! It will appear the next time {friend.name} gets locked out:</div>
          <div className="bubble" style={{ maxWidth: '100%' }}>{result.prompt}</div>
          <ProviderBadge provider={result.provider === 'you' ? undefined : result.provider} />
          {friend.isDemo && <div className="small muted">(Demo friend: they sent one straight back to you — get locked down to see it.)</div>}
        </div>
      ) : (
        <>
          <button className="btn primary sm" disabled={busy} onClick={() => sendIt(true)}>✨ Let the AI write one</button>
          <div className="divider" />
          <input className="input" placeholder="…or write your own: question / dare" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <input className="input" placeholder="Accepted answers, comma-separated" value={answer} onChange={(e) => setAnswer(e.target.value)} />
          <button className="btn sm" disabled={busy || !prompt.trim() || !answer.trim()} onClick={() => sendIt(false)}>Send mine</button>
        </>
      )}
    </div>
  );
}
