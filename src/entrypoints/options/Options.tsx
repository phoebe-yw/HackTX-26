import { useEffect, useState } from 'react';
import * as store from '@/core/storage';
import type { Settings } from '@/core/types';
import { CHARACTERS } from '@/data/characters';
import { CharacterArt } from '@/ui/components/CharacterArt';
import { useStored } from '@/ui/hooks';
import { DevPanel } from './DevPanel';
import { CharacterPicker, MethodPicker, ScreenToggle, SitesEditor, StrictnessPicker, TopicField } from './Forms';

type Tab = 'tale' | 'sites' | 'dev';

export function Options() {
  const [saved] = useStored('settings');
  const [draft, setDraft] = useState<Settings | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(() => (location.hash === '#dev' ? 'dev' : 'tale'));
  const [onboarding, setOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    if (saved && !draft) {
      setDraft(saved);
      setOnboarding(!saved.onboarded || location.hash === '#onboarding');
    }
  }, [saved, draft]);
  // Keep live-only fields (demoMode, hiddenSites, disabled…) in sync when changed elsewhere
  useEffect(() => {
    if (saved && draft) setDraft((d) => (d ? { ...d, demoMode: saved.demoMode, hiddenSites: saved.hiddenSites, disabled: saved.disabled, widgetPos: saved.widgetPos } : d));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.demoMode, saved?.hiddenSites, saved?.disabled, saved?.widgetPos]);

  function showToast(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 1800);
  }
  const patch = (p: Partial<Settings>) => setDraft((d) => (d ? { ...d, ...p } : d));
  async function save(extra: Partial<Settings> = {}) {
    if (!draft) return;
    const next = { ...draft, ...extra };
    await store.update('settings', next);
    setDraft(next);
    showToast('Saved ✦');
  }

  if (!draft || onboarding === null) return null;

  if (onboarding) {
    return (
      <Onboarding
        s={draft}
        patch={patch}
        onDone={async () => {
          await save({ onboarded: true });
          setOnboarding(false);
          location.hash = '';
        }}
      />
    );
  }

  return (
    <div className="page ouaf">
      <div className="parchment book">
        <div className="row">
          <CharacterArt id={draft.characterId} pose="happy" size={64} />
          <div>
            <h1>Once Upon a Focus</h1>
            <div className="muted">Your companion: <b>{draft.petName}</b> the {CHARACTERS[draft.characterId].name}</div>
          </div>
          <span className="spacer" />
          <button className="btn sm" onClick={() => { setOnboarding(true); location.hash = '#onboarding'; }}>↺ Redo onboarding</button>
        </div>
        <div className="tabs">
          <button className={`btn sm ${tab === 'tale' ? 'active' : ''}`} onClick={() => setTab('tale')}>📖 Your tale</button>
          <button className={`btn sm ${tab === 'sites' ? 'active' : ''}`} onClick={() => setTab('sites')}>🌐 Sites & privacy</button>
          <button className={`btn sm ${tab === 'dev' ? 'active' : ''}`} onClick={() => { setTab('dev'); location.hash = '#dev'; }}>🎭 Demo & dev</button>
        </div>

        {tab === 'tale' && (
          <div className="col" style={{ gap: 18 }}>
            <section className="col"><h2>Your companion</h2><CharacterPicker s={draft} patch={patch} /></section>
            <section className="col"><h2>Your quest</h2><TopicField s={draft} patch={patch} /></section>
            <section className="col"><h2>Your rhythm</h2><MethodPicker s={draft} patch={patch} /></section>
            <section className="col"><h2>Strictness</h2><StrictnessPicker s={draft} patch={patch} /></section>
            <div className="nav-row"><button className="btn primary" onClick={() => save()}>Save</button></div>
          </div>
        )}
        {tab === 'sites' && (
          <div className="col" style={{ gap: 18 }}>
            <section className="col"><h2>Sites</h2><SitesEditor s={draft} patch={patch} /></section>
            <section className="col"><h2>Privacy</h2><ScreenToggle s={draft} patch={patch} /></section>
            <section className="col">
              <h2>Widget</h2>
              <div className="kv">
                <span>Hidden on: {draft.hiddenSites.length ? draft.hiddenSites.join(', ') : 'nowhere'}</span>
                <button className="btn sm" onClick={() => patch({ hiddenSites: [] })}>Clear</button>
                <span>Extension {draft.disabled ? 'is DISABLED' : 'is enabled'}</span>
                <button className="btn sm" onClick={() => patch({ disabled: !draft.disabled })}>{draft.disabled ? 'Enable' : 'Disable'}</button>
              </div>
            </section>
            <div className="nav-row"><button className="btn primary" onClick={() => save()}>Save</button></div>
          </div>
        )}
        {tab === 'dev' && <DevPanel s={draft} patch={(p) => void store.update('settings', p)} toast={showToast} />}
      </div>
      {toast && <div className="parchment toast">{toast}</div>}
    </div>
  );
}

// ---------------- Onboarding storybook ----------------
function Onboarding({ s, patch, onDone }: { s: Settings; patch: (p: Partial<Settings>) => void; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const total = 7;
  const c = CHARACTERS[s.characterId];
  const next = () => setStep((x) => Math.min(total - 1, x + 1));
  const back = () => setStep((x) => Math.max(0, x - 1));
  const canNext = step === 1 ? s.petName.trim().length > 0 : step === 2 ? s.topic.trim().length > 0 : true;

  return (
    <div className="page ouaf">
      <div className="parchment book anim-flip" key={step}>
        <div className="row">
          <div className="step-dots">{Array.from({ length: total }, (_, i) => <span key={i} className={i <= step ? 'on' : ''} />)}</div>
          <span className="spacer" />
          <span className="small muted">page {step + 1} of {total}</span>
        </div>

        {step === 0 && (
          <div className="col center" style={{ alignItems: 'center', gap: 14, paddingTop: 20 }}>
            <h1 style={{ fontSize: 56 }}>Once Upon a Focus</h1>
            <p style={{ maxWidth: 520 }}>
              Once upon a time, a student opened forty tabs and finished none of them. Then a tiny fairytale companion moved
              into the corner of their screen — cheering when they studied, sulking when they strayed, and locking the
              gates when things got out of hand.
            </p>
            <p className="muted">This takes about a minute. Every choice can be changed later.</p>
            <div className="row" style={{ gap: 6 }}>
              {(['red', 'cinderella', 'wolf', 'duck', 'humpty'] as const).map((id) => <CharacterArt key={id} id={id} pose="happy" size={64} />)}
            </div>
          </div>
        )}
        {step === 1 && (<><h2>Choose your companion</h2><p className="muted">Each one has a very different idea of “encouragement.”</p><CharacterPicker s={s} patch={patch} /></>)}
        {step === 2 && (<><h2>What is your quest, {s.petName}'s scholar?</h2><TopicField s={s} patch={patch} /></>)}
        {step === 3 && (<><h2>Choose your rhythm</h2><p className="muted">Cinderella's clock will strike at the end of every block.</p><MethodPicker s={s} patch={patch} /></>)}
        {step === 4 && (<><h2>How strict should {s.petName} be?</h2><StrictnessPicker s={s} patch={patch} /></>)}
        {step === 5 && (<><h2>The lay of the land</h2><p className="muted">Sites that are always fine, sites that are always trouble, and whether {s.petName} may peek at your screen.</p><SitesEditor s={s} patch={patch} /><ScreenToggle s={s} patch={patch} /></>)}
        {step === 6 && (
          <div className="col center" style={{ alignItems: 'center', gap: 14, paddingTop: 10 }}>
            <CharacterArt id={s.characterId} pose="celebrate" size={160} />
            <h2>…and so the tale begins.</h2>
            <p style={{ maxWidth: 520 }}>
              <b>{s.petName}</b> the {c.name} now lives in the corner of every page. Click them to open the book, drag them
              anywhere, and press <b>Begin the chapter</b> to start your first {s.method.id === 'none' ? 'session' : `${s.method.focusMin}-minute block`}.
            </p>
            <p className="muted small">“{c.lines.encourage[0]}”</p>
          </div>
        )}

        <div className="nav-row">
          {step > 0 && <button className="btn" onClick={back}>← Back</button>}
          <span className="spacer" />
          {step < total - 1 ? (
            <button className="btn primary" disabled={!canNext} onClick={next}>{step === 0 ? 'Turn the page →' : 'Next →'}</button>
          ) : (
            <button className="btn primary" onClick={onDone}>✦ Begin</button>
          )}
        </div>
      </div>
    </div>
  );
}
