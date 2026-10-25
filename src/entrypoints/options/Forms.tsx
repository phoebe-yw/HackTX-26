import { useState } from 'react';
import { METHOD_PRESETS } from '@/core/defaults';
import type { CharacterId, Settings, Strictness, StudyMethod } from '@/core/types';
import { CHARACTERS, CHARACTER_LIST } from '@/data/characters';
import { CharacterArt } from '@/ui/components/CharacterArt';

export type Patch = (p: Partial<Settings>) => void;

export function CharacterPicker({ s, patch }: { s: Settings; patch: Patch }) {
  return (
    <div className="col">
      <div className="char-grid">
        {CHARACTER_LIST.map((c) => (
          <div
            key={c.id}
            className={`char-card ${s.characterId === c.id ? 'on' : ''}`}
            onClick={() =>
              patch({
                characterId: c.id as CharacterId,
                petName: !s.petName || Object.values(CHARACTERS).some((x) => x.defaultPetName === s.petName) ? c.defaultPetName : s.petName,
              })
            }
          >
            <CharacterArt id={c.id} pose={s.characterId === c.id ? 'celebrate' : 'idle'} size={96} />
            <div className="nm">{c.name}</div>
            <div className="tg">{c.tagline}</div>
          </div>
        ))}
      </div>
      <div className="field">
        <label>Name your companion</label>
        <input className="input" value={s.petName} onChange={(e) => patch({ petName: e.target.value })} maxLength={24} />
      </div>
    </div>
  );
}

export function TopicField({ s, patch }: { s: Settings; patch: Patch }) {
  return (
    <div className="field">
      <label>What are you studying?</label>
      <input
        className="input"
        placeholder="e.g. Organic Chemistry — chapter 7 reactions"
        value={s.topic}
        onChange={(e) => patch({ topic: e.target.value })}
        maxLength={140}
      />
      <div className="small muted">
        This is how {s.petName || 'your companion'} knows what “on task” means, and what to quiz you on when you stray.
      </div>
    </div>
  );
}

const METHOD_INFO: { id: StudyMethod['id']; t: string; d: string }[] = [
  { id: 'pomodoro', t: 'Pomodoro', d: '25 focus / 5 break, 15 long break every 4' },
  { id: '52-17', t: '52 / 17', d: '52 focus / 17 break' },
  { id: 'deep', t: 'Deep Work', d: '90 focus / 20 break' },
  { id: 'custom', t: 'Custom', d: 'Set your own rhythm' },
  { id: 'none', t: 'No method', d: 'Just keep me focused — no timer' },
];

export function MethodPicker({ s, patch }: { s: Settings; patch: Patch }) {
  const m = s.method;
  const setNum = (k: keyof StudyMethod, v: string) => patch({ method: { ...m, id: 'custom', [k]: Math.max(0, Number(v) || 0) } });
  return (
    <div className="col">
      <div className="opt-grid">
        {METHOD_INFO.map((o) => (
          <div
            key={o.id}
            className={`opt ${m.id === o.id ? 'on' : ''}`}
            onClick={() => patch({ method: o.id === 'custom' ? { ...m, id: 'custom' } : METHOD_PRESETS[o.id] })}
          >
            <div className="t">{o.t}</div>
            <div className="d">{o.d}</div>
          </div>
        ))}
      </div>
      {m.id === 'custom' && (
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <div className="field"><label>Focus (min)</label><input className="input" type="number" value={m.focusMin} onChange={(e) => setNum('focusMin', e.target.value)} /></div>
          <div className="field"><label>Break (min)</label><input className="input" type="number" value={m.breakMin} onChange={(e) => setNum('breakMin', e.target.value)} /></div>
          <div className="field"><label>Long break (min)</label><input className="input" type="number" value={m.longBreakMin} onChange={(e) => setNum('longBreakMin', e.target.value)} /></div>
          <div className="field"><label>Long break every</label><input className="input" type="number" value={m.longBreakEvery} onChange={(e) => setNum('longBreakEvery', e.target.value)} /></div>
        </div>
      )}
    </div>
  );
}

const STRICT: { id: Strictness; t: string; d: string }[] = [
  { id: 'gentle', t: '🧚 Gentle', d: 'Slow to anger. Easy trials. A fairy godmother.' },
  { id: 'firm', t: '🛡️ Firm', d: 'Fair but watchful. Medium trials.' },
  { id: 'wolf', t: '🐺 Big Bad Wolf', d: 'Escalates fast. Hard trials. Oaths typed backwards.' },
];

export function StrictnessPicker({ s, patch }: { s: Settings; patch: Patch }) {
  return (
    <div className="opt-grid">
      {STRICT.map((o) => (
        <div key={o.id} className={`opt ${s.strictness === o.id ? 'on' : ''}`} onClick={() => patch({ strictness: o.id })}>
          <div className="t">{o.t}</div>
          <div className="d">{o.d}</div>
        </div>
      ))}
    </div>
  );
}

function ChipList({ list, onChange, kind, placeholder }: { list: string[]; onChange: (l: string[]) => void; kind: 'ok' | 'bad'; placeholder: string }) {
  const [val, setVal] = useState('');
  const add = () => {
    const v = val.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (v && !list.includes(v)) onChange([...list, v]);
    setVal('');
  };
  return (
    <div className="col">
      <div className="chips">
        {list.map((d) => (
          <span key={d} className={`chip ${kind}`}>
            {d}
            <button onClick={() => onChange(list.filter((x) => x !== d))} title="Remove">✕</button>
          </span>
        ))}
      </div>
      <div className="row">
        <input className="input" placeholder={placeholder} value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn sm" onClick={add}>Add</button>
      </div>
    </div>
  );
}

export function SitesEditor({ s, patch }: { s: Settings; patch: Patch }) {
  return (
    <div className="settings-grid">
      <div className="field">
        <label>✅ Always okay (never counts as drifting)</label>
        <ChipList list={s.allowSites} onChange={(l) => patch({ allowSites: l })} kind="ok" placeholder="canvas.instructure.com" />
      </div>
      <div className="field">
        <label>🚫 Always distracting</label>
        <ChipList list={s.blockSites} onChange={(l) => patch({ blockSites: l })} kind="bad" placeholder="youtube.com" />
      </div>
    </div>
  );
}

export function ScreenToggle({ s, patch }: { s: Settings; patch: Patch }) {
  return (
    <div className={`opt ${s.screenCheckEnabled ? 'on' : ''}`} onClick={() => patch({ screenCheckEnabled: !s.screenCheckEnabled })}>
      <div className="t">👁️ Let {s.petName || 'your companion'} peek at your screen {s.screenCheckEnabled ? '— ON' : '— OFF'}</div>
      <div className="d">
        During focus sessions only, a downscaled screenshot of the current tab is sent to Gemini to judge whether you're on
        task and to roast you accurately. Screenshots are never stored, skipped on sensitive sites (email, banking) and in
        incognito, and you'll see a 👁️ whenever it's looking. This is the magic behind “explain what's on my screen.”
      </div>
    </div>
  );
}
