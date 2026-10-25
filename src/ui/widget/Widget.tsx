import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { send } from '@/core/messaging';
import { phaseDurationMs, remainingMs } from '@/core/session';
import * as store from '@/core/storage';
import type { Pose, WidgetSize } from '@/core/types';
import { hostnameOf } from '@/core/util';
import { CHARACTERS, MOOD_EMOJI } from '@/data/characters';
import { CharacterArt, poseForLevel } from '../components/CharacterArt';
import { useNow, useStored } from '../hooks';
import { AskPage } from './pages/AskPage';
import { HomePage } from './pages/HomePage';
import { QuotesPage } from './pages/QuotesPage';
import { TablePage } from './pages/TablePage';
import { TavernPage } from './pages/TavernPage';

type Page = 'home' | 'table' | 'ask' | 'quotes' | 'tavern';
const PAGES: { id: Page; ico: string; label: string }[] = [
  { id: 'home', ico: '🏰', label: 'Home' },
  { id: 'table', ico: '🪑', label: 'Table' },
  { id: 'ask', ico: '🪞', label: 'Ask' },
  { id: 'quotes', ico: '📜', label: 'Quotes' },
  { id: 'tavern', ico: '🍻', label: 'Tavern' },
];

const AVATAR_PX: Record<WidgetSize, number> = { S: 60, M: 84, L: 110 };

export function Widget({ onHidden }: { onHidden: () => void }) {
  const [settings] = useStored('settings');
  const [session] = useStored('session');
  const [mood] = useStored('mood');
  const [lockdown] = useStored('lockdown');
  const now = useNow(1000);
  const [page, setPage] = useState<Page>('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [guilt, setGuilt] = useState<string | null>(null);

  // ----- position / drag
  const rootRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  const collapsed = settings?.collapsed ?? true;
  const avatarPx = AVATAR_PX[settings?.widgetSize ?? 'M'];

  const clampPos = useCallback(
    (p: { x: number; y: number }) => {
      const el = rootRef.current;
      const w = el?.offsetWidth ?? avatarPx;
      const h = el?.offsetHeight ?? avatarPx;
      return {
        x: Math.max(4, Math.min(window.innerWidth - w - 4, p.x)),
        y: Math.max(4, Math.min(window.innerHeight - h - 4, p.y)),
      };
    },
    [avatarPx],
  );

  useEffect(() => {
    if (!settings) return;
    const p = settings.widgetPos ?? { x: window.innerWidth - avatarPx - 24, y: window.innerHeight - avatarPx - 24 };
    setPos(clampPos(p));
  }, [settings?.widgetPos, avatarPx, clampPos, settings]);

  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clampPos(p) : p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampPos]);

  // Re-clamp when expanding/collapsing so the card stays on screen
  useEffect(() => {
    const id = requestAnimationFrame(() => setPos((p) => (p ? clampPos(p) : p)));
    return () => cancelAnimationFrame(id);
  }, [collapsed, page, clampPos]);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 || !pos) return;
    // Don't hijack clicks on buttons inside the drag handle (pointer capture would eat the click)
    if ((e.target as HTMLElement).closest('button')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) > 4) {
      d.moved = true;
      setDragging(true);
    }
    if (d.moved) setPos(clampPos({ x: d.ox + dx, y: d.oy + dy }));
  }
  async function onPointerUp(e: React.PointerEvent, clickAction?: () => void) {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (!d) return;
    if (d.moved) {
      const p = clampPos({ x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) });
      await store.update('settings', { widgetPos: p });
    } else clickAction?.();
  }

  // ----- heartbeat (drives the mood engine; faster in demo mode)
  const demoMode = settings?.demoMode ?? false;
  const disabled = settings?.disabled ?? true;
  useEffect(() => {
    if (disabled) return;
    const beat = () => {
      if (document.visibilityState !== 'visible') return;
      void send('focus:heartbeat', { url: location.href, title: document.title, visible: true }).catch(() => {});
    };
    beat();
    const id = setInterval(beat, demoMode ? 5000 : 20000);
    document.addEventListener('visibilitychange', beat);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [demoMode, disabled]);

  // ----- phase expiry backstop (alarms have 30s granularity; demo phases are seconds)
  const expiredSent = useRef(0);
  useEffect(() => {
    if (!session || session.status === 'idle' || session.paused || session.phaseEndsAt === 0) return;
    if (now >= session.phaseEndsAt + 300 && expiredSent.current !== session.phaseEndsAt) {
      expiredSent.current = session.phaseEndsAt;
      void send('session:expired', { phaseEndsAt: session.phaseEndsAt }).catch(() => {});
    }
  }, [now, session]);

  // ----- derived
  const level = mood?.level ?? 0;
  const celebrating = Boolean(mood && now - mood.lastUnlockAt < 4000);
  const sleeping = session?.status === 'idle';
  const pose: Pose = poseForLevel(level, { celebrating, sleeping });
  const bubbleTtl = settings?.demoMode ? 7000 : 9000;
  const bubbleLine = guilt
    ? { text: guilt, kind: 'guilt' }
    : mood?.lastLine && now - mood.lastLine.at < bubbleTtl
      ? { text: mood.lastLine.text, kind: mood.lastLine.kind }
      : null;

  const total = session && settings ? phaseDurationMs(session.status, settings) : 0;
  const remaining = session ? remainingMs(session, now) : 0;
  const progress = total > 0 ? 1 - remaining / total : 0;

  const tavernUnlocked = session?.status !== 'focus' || Boolean(settings?.demoMode);

  const onboardCta = useMemo(() => settings && !settings.onboarded, [settings]);

  // Hide/disable: the pet gets to react first (guilt-trip), then we actually go.
  async function hideHere() {
    if (!settings) return;
    setMenuOpen(false);
    const host = hostnameOf(location.href);
    const r = await send('widget:hidden', { how: 'hide' });
    const go = async () => {
      const cur = await store.get('settings');
      await store.update('settings', { hiddenSites: [...new Set([...cur.hiddenSites, host])] });
      onHidden();
    };
    if (r.line) {
      setGuilt(r.line);
      setTimeout(go, 2800);
    } else void go();
  }
  async function disable() {
    setMenuOpen(false);
    const r = await send('widget:hidden', { how: 'disable' });
    const go = async () => {
      await store.update('settings', { disabled: true });
      onHidden();
    };
    if (r.line) {
      setGuilt(r.line);
      setTimeout(go, 2800);
    } else void go();
  }

  if (!settings || !session || !mood || !lockdown || !pos) return null;

  const c = CHARACTERS[settings.characterId];

  // ---------- collapsed: just the character + timer ring ----------
  if (collapsed) {
    const r = 46;
    const circ = 2 * Math.PI * r;
    return (
      <div className="widget-root ouaf" ref={rootRef} style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}>
        {bubbleLine && (
          <div className="bubble-anchor">
            <div className={`bubble ${bubbleLine.kind}`}>{bubbleLine.text}</div>
          </div>
        )}
        <div
          className={`avatar-wrap ${dragging ? 'dragging' : ''}`}
          style={{ width: avatarPx, height: avatarPx }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => onPointerUp(e, () => store.update('settings', { collapsed: false }))}
          title={`${settings.petName || c.name} — click to open, drag to move`}
        >
          <div className={`avatar-disc ${mood.looking ? 'looking' : ''}`} />
          {session.status !== 'idle' && total > 0 && (
            <svg className="avatar-ring" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(61,46,26,0.15)" strokeWidth="5" />
              <circle
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={session.status === 'focus' ? 'var(--gold)' : 'var(--powder)'}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - progress)}
                transform="rotate(-90 50 50)"
                style={{ transition: 'stroke-dashoffset 0.9s linear' }}
              />
            </svg>
          )}
          <div className={`avatar-art ${pose === 'furious' ? 'anim-rage' : pose === 'annoyed' ? 'anim-wobble' : sleeping ? '' : 'anim-bob'}`}>
            <CharacterArt id={settings.characterId} pose={pose} size={avatarPx * 0.8} />
          </div>
          {session.status !== 'idle' && <div className="avatar-mood">{MOOD_EMOJI[level]}</div>}
          {mood.looking && <div className="avatar-eye" title="Peeking at your screen (Gemini)">👁️</div>}
        </div>
      </div>
    );
  }

  // ---------- expanded card ----------
  return (
    <div className="widget-root ouaf" ref={rootRef} style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}>
      <div className="parchment card">
        <div
          className="card-header"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => onPointerUp(e)}
        >
          <span className="title">{settings.petName || c.name}</span>
          <span className="muted small">· {c.name}</span>
          <span className="spacer" />
          {mood.looking && <span title="Peeking at your screen (Gemini)">👁️</span>}
          <button className="btn ghost icon sm" title="Menu" onClick={() => setMenuOpen((v) => !v)}>
            ☰
          </button>
          <button className="btn ghost icon sm" title="Collapse" onClick={() => store.update('settings', { collapsed: true })}>
            ✕
          </button>
        </div>

        {menuOpen && (
          <div className="parchment menu" onMouseLeave={() => setMenuOpen(false)}>
            <div className="label">Size</div>
            <div className="row" style={{ padding: '0 6px 4px' }}>
              {(['S', 'M', 'L'] as WidgetSize[]).map((s) => (
                <button
                  key={s}
                  className={`btn sm ${settings.widgetSize === s ? 'primary' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => store.update('settings', { widgetSize: s })}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="label">Visibility</div>
            <button onClick={hideHere}>🙈 Hide on {hostnameOf(location.href) || 'this site'}</button>
            <button onClick={disable}>⏸ Disable the extension</button>
            <div className="label">More</div>
            <button onClick={() => send('dev:openOptions', {})}>⚙️ Settings & onboarding</button>
          </div>
        )}

        <div className="card-body" key={page}>
          {onboardCta && page === 'home' && (
            <div className="onboard-cta col">
              <div className="display" style={{ fontSize: 22 }}>Once upon a time…</div>
              <div className="muted">…a student needed a companion. Let's write your first page.</div>
              <button className="btn primary" onClick={() => send('dev:openOptions', {})}>
                ✦ Begin your tale
              </button>
            </div>
          )}
          {!(onboardCta && page === 'home') && (
            <div className="anim-flip">
              {page === 'home' && (
                <HomePage
                  settings={settings}
                  session={session}
                  mood={mood}
                  lockdown={lockdown}
                  pose={pose}
                  now={now}
                  bubbleText={bubbleLine?.text ?? null}
                  bubbleKind={bubbleLine?.kind ?? ''}
                />
              )}
              {page === 'table' && <TablePage settings={settings} onOpenTavern={() => setPage('tavern')} />}
              {page === 'ask' && <AskPage settings={settings} />}
              {page === 'quotes' && <QuotesPage settings={settings} />}
              {page === 'tavern' && <TavernPage settings={settings} session={session} />}
            </div>
          )}
        </div>

        <div className="card-nav">
          {PAGES.map((p) => (
            <button
              key={p.id}
              className={page === p.id ? 'active' : ''}
              onClick={() => setPage(p.id)}
              disabled={p.id === 'tavern' && !tavernUnlocked}
              title={p.id === 'tavern' && !tavernUnlocked ? 'Opens on your break' : p.label}
            >
              <span className="ico">{p.ico}</span>
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
