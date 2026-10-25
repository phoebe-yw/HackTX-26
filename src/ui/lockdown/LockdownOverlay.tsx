import { useEffect, useRef, useState } from 'react';
import { send } from '@/core/messaging';
import type { LockdownState, Settings } from '@/core/types';
import { CHARACTERS } from '@/data/characters';
import { CharacterArt } from '../components/CharacterArt';
import { ProviderBadge } from '../components/ProviderBadge';
import { ChallengeView } from './Challenges';

const ESC_HOLD_MS = 5000;

export function LockdownOverlay({ settings, lockdown }: { settings: Settings; lockdown: LockdownState }) {
  const c = CHARACTERS[settings.characterId];
  const [shaking, setShaking] = useState(true);
  const [escProgress, setEscProgress] = useState(0);
  const escStart = useRef<number | null>(null);
  const raf = useRef(0);
  const [escaping, setEscaping] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShaking(false), 1500);
    return () => clearTimeout(t);
  }, []);

  // Safety valve: hold Esc for 5 seconds
  useEffect(() => {
    const tick = () => {
      if (escStart.current === null) return;
      const p = Math.min(1, (Date.now() - escStart.current) / ESC_HOLD_MS);
      setEscProgress(p);
      if (p >= 1) {
        escStart.current = null;
        setEscaping(true);
        void send('lockdown:escape', { url: location.href });
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    const down = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      if (escStart.current === null) {
        escStart.current = Date.now();
        raf.current = requestAnimationFrame(tick);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      escStart.current = null;
      cancelAnimationFrame(raf.current);
      setEscProgress(0);
    };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  // Block page scroll while locked
  useEffect(() => {
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, []);

  const entrance = CHARACTERS[settings.characterId].lines.lockdownEntrance[0];

  return (
    <div className={`lock-root ouaf ${shaking ? 'shaking' : ''}`} onContextMenu={(e) => e.preventDefault()}>
      <Vines />
      <div className="parchment lock-card">
        <div className="lock-head">
          <div className="anim-rage">
            <CharacterArt id={settings.characterId} pose="furious" size={96} />
          </div>
          <div>
            <div className="title">
              <span className="shaky-text">LOCKDOWN</span>
            </div>
            <div className="sub">
              {settings.petName || c.name} says: “{entrance}”
            </div>
            {lockdown.triggerActivity && (
              <div className="small muted">Caught: {lockdown.triggerActivity}</div>
            )}
          </div>
        </div>
        <div className="divider" />

        {escaping ? (
          <div className="center col">
            <div className="display" style={{ fontSize: 22 }}>…fine.</div>
            <div className="muted">{c.lines.sulk[0]} (This escape was logged.)</div>
          </div>
        ) : lockdown.challenge ? (
          <ChallengeView
            key={JSON.stringify(lockdown.challenge).slice(0, 80)}
            challenge={lockdown.challenge}
            onSolved={() => void send('lockdown:solved', {})}
            onFailed={() => void send('lockdown:failed', {})}
          />
        ) : (
          <div className="center col" style={{ padding: 20 }}>
            <div className="display loading-dots" style={{ fontSize: 22 }}>
              {settings.petName || c.name} is preparing your trial
            </div>
            <div className="muted small">(Summoning a challenge from the spellbook)</div>
          </div>
        )}

        <div className="lock-foot">
          {lockdown.challengeProvider && lockdown.challengeProvider !== 'curated' && lockdown.challengeProvider !== 'friend' && (
            <ProviderBadge provider={lockdown.challengeProvider} prefix="trial" />
          )}
          {lockdown.challengeProvider === 'curated' && <span className="badge offline">📜 from the storybook</span>}
          <span className="spacer" />
          {lockdown.challenge && lockdown.failures >= 2 && (
            <button className="btn sm" onClick={() => send('lockdown:newChallenge', {})}>
              Different trial
            </button>
          )}
          <span title="Safety valve: hold Esc for 5 seconds if you really need out">
            hold <kbd>Esc</kbd> 5s to escape
          </span>
          <div className="esc-bar">
            <div style={{ width: `${escProgress * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function UnlockBurst() {
  const sparks = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return { x: Math.cos(a) * 160, y: Math.sin(a) * 160, d: i * 0.05 };
  });
  return (
    <div className="unlock-burst ouaf">
      <div className="slipper">👠</div>
      {sparks.map((s, i) => (
        <span key={i} className="spark" style={{ transform: `translate(${s.x}px, ${s.y}px)`, animationDelay: `${s.d}s` }}>
          ✨
        </span>
      ))}
    </div>
  );
}

function Vines() {
  return (
    <svg className="lock-vines" viewBox="0 0 1000 600" preserveAspectRatio="none">
      <path d="M0 600 C 120 480, 60 380, 160 300 S 220 120, 140 0" stroke="#87A28A" strokeWidth="6" fill="none" />
      <path d="M1000 0 C 880 120, 940 220, 840 300 S 780 480, 860 600" stroke="#87A28A" strokeWidth="6" fill="none" />
      {[80, 180, 260].map((y, i) => (
        <ellipse key={i} cx={150 - i * 10} cy={y} rx="18" ry="9" fill="#87A28A" transform={`rotate(-30 ${150 - i * 10} ${y})`} />
      ))}
      {[340, 440, 520].map((y, i) => (
        <ellipse key={i} cx={850 + i * 10} cy={y} rx="18" ry="9" fill="#87A28A" transform={`rotate(30 ${850 + i * 10} ${y})`} />
      ))}
    </svg>
  );
}
