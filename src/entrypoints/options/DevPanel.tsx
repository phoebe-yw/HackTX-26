import { useState } from 'react';
import { send } from '@/core/messaging';
import * as store from '@/core/storage';
import type { AiProviderId, ChallengeType, Settings } from '@/core/types';
import { useStored } from '@/ui/hooks';

const PROVIDERS: AiProviderId[] = ['gemini', 'meta', 'offline'];

export function DevPanel({ s, patch, toast }: { s: Settings; patch: (p: Partial<Settings>) => void; toast: (m: string) => void }) {
  const [overrides] = useStored('aiOverrides');
  const [lastProv] = useStored('aiLastProvider');
  const [escapeLog] = useStored('escapeLog');
  const [mood] = useStored('mood');
  const [ping, setPing] = useState<Record<string, string>>({});
  const [tests, setTests] = useState<{ fn: string; ok: boolean; provider: string; ms: number; error?: string }[] | null>(null);
  const [testing, setTesting] = useState(false);
  const [screen, setScreen] = useState<string | null>(null);

  async function doPing(p: AiProviderId) {
    setPing((x) => ({ ...x, [p]: '…' }));
    const r = await send('ai:ping', { provider: p });
    setPing((x) => ({ ...x, [p]: `${r.ok ? '✅' : '❌'} ${r.text} (${r.ms}ms)` }));
  }
  async function runTests() {
    setTesting(true);
    setTests(null);
    try {
      const r = await send('ai:testSocial', {});
      setTests(r.results);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="col" style={{ gap: 18 }}>
      <section className="col">
        <h2>🎭 Demo Mode</h2>
        <div className={`opt ${s.demoMode ? 'on' : ''}`} onClick={async () => { await send('demo:set', { enabled: !s.demoMode }); toast(s.demoMode ? 'Demo Mode off' : 'Demo Mode ON'); }}>
          <div className="t">{s.demoMode ? 'ON — timers in seconds, fast escalation, fake friends, bot stranger' : 'OFF — real timings'}</div>
          <div className="d">25 min → 25 s · mood climbs to lockdown in ~30 s of drifting · screen check every 5 s · Study Table seeded with storybook friends.</div>
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className="small muted">Mood score: {Math.round(mood?.score ?? 0)} (level {mood?.level ?? 0})</span>
          <input type="range" min={0} max={100} value={Math.round(mood?.score ?? 0)} onChange={(e) => send('demo:setMood', { score: Number(e.target.value) })} style={{ flex: 1 }} />
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className="small muted">Force lockdown:</span>
          {(['riddle', 'quiz', 'oath', 'friend'] as ChallengeType[]).map((t) => (
            <button key={t} className="btn sm" onClick={() => send('lockdown:force', { type: t })}>{t}</button>
          ))}
          <button className="btn sm" onClick={() => send('lockdown:force', {})}>random</button>
        </div>
      </section>

      <section className="col">
        <h2>🧠 AI providers</h2>
        <div className="settings-grid">
          {(['vision', 'social'] as const).map((mod) => (
            <div key={mod} className="field">
              <label>{mod === 'vision' ? '👁️ visionAI (the eyes — always Gemini)' : '✨ socialAI (the social brain)'}</label>
              <div className="row">
                {PROVIDERS.map((p) => (
                  <button
                    key={p}
                    className={`btn sm ${(overrides?.[mod] ?? (mod === 'vision' ? (import.meta.env.WXT_VISION_AI_PROVIDER || 'gemini') : (import.meta.env.WXT_SOCIAL_AI_PROVIDER || 'gemini'))) === p ? 'primary' : ''}`}
                    disabled={mod === 'vision' && p !== 'gemini'}
                    onClick={() => store.update('aiOverrides', { [mod]: p })}
                  >
                    {p}
                  </button>
                ))}
                <button className="btn sm ghost" title="Use .env default" onClick={() => store.update('aiOverrides', { [mod]: null })}>reset</button>
              </div>
              <div className="small muted">
                env default: {mod === 'vision' ? import.meta.env.WXT_VISION_AI_PROVIDER || 'gemini' : import.meta.env.WXT_SOCIAL_AI_PROVIDER || 'gemini'}
              </div>
            </div>
          ))}
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {PROVIDERS.filter((p) => p !== 'offline').map((p) => (
            <button key={p} className="btn sm" onClick={() => doPing(p)}>Ping {p}</button>
          ))}
          <button className="btn sm primary" disabled={testing} onClick={runTests}>{testing ? 'Testing…' : 'Test all socialAI functions'}</button>
          <button className="btn sm" onClick={async () => { setScreen('…'); const r = await send('ai:screenCheckNow', {}); setScreen(r.summary); }}>Screen check now</button>
        </div>
        {Object.entries(ping).map(([p, r]) => (
          <div key={p} className="small"><b>{p}:</b> {r}</div>
        ))}
        {screen && <div className="small"><b>screen check:</b> {screen}</div>}
        {tests && (
          <div>
            <div className="test-row"><b>function</b><b>ok</b><b>answered by</b><b>ms</b></div>
            {tests.map((t) => (
              <div key={t.fn} className="test-row">
                <span>{t.fn}{t.error ? <span className="bad"> — {t.error}</span> : null}</span>
                <span className={t.ok ? 'ok' : 'bad'}>{t.ok ? 'PASS' : 'FALLBACK'}</span>
                <span>{t.provider}</span>
                <span>{t.ms}</span>
              </div>
            ))}
            <div className="small muted" style={{ marginTop: 6 }}>PASS = answered by a live provider. FALLBACK = curated offline content was used.</div>
          </div>
        )}
        <div className="small muted">
          Last provider per function: {lastProv && Object.keys(lastProv).length ? Object.entries(lastProv).map(([k, v]) => `${k}→${v}`).join(' · ') : '—'}
        </div>
      </section>

      <section className="col">
        <h2>🧹 Housekeeping</h2>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn sm" onClick={() => patch({ hiddenSites: [] })}>Un-hide on all sites</button>
          <button className="btn sm" onClick={() => patch({ disabled: false })}>Re-enable widget</button>
          <button className="btn sm" onClick={() => patch({ widgetPos: null })}>Reset widget position</button>
          <button className="btn sm danger" onClick={async () => { if (confirm('Reset ALL data (settings, session, friends)?')) { await send('dev:resetAll', {}); location.hash = ''; location.reload(); } }}>Reset everything</button>
        </div>
        <div className="small muted">Escape log ({escapeLog?.length ?? 0}): {escapeLog?.slice(-5).map((e) => new Date(e.at).toLocaleTimeString()).join(', ') || '—'}</div>
      </section>
    </div>
  );
}
