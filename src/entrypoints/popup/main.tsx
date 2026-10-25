import ReactDOM from 'react-dom/client';
import { send } from '@/core/messaging';
import * as store from '@/core/storage';
import { CHARACTERS, MOOD_EMOJI, MOOD_LABEL } from '@/data/characters';
import { CharacterArt } from '@/ui/components/CharacterArt';
import { useStored } from '@/ui/hooks';
import '@/ui/theme.css';
import '../options/options.css';

function Popup() {
  const [s] = useStored('settings');
  const [mood] = useStored('mood');
  const [session] = useStored('session');
  if (!s) return null;
  const c = CHARACTERS[s.characterId];
  return (
    <div className="ouaf" style={{ padding: 12, background: 'var(--parchment)' }}>
      <div className="row">
        <CharacterArt id={s.characterId} pose={s.disabled ? 'sleeping' : 'happy'} size={56} />
        <div>
          <div className="display" style={{ fontSize: 22 }}>{s.petName || c.name}</div>
          <div className="small muted">
            {s.disabled ? 'disabled' : session?.status === 'idle' ? 'napping' : `${MOOD_EMOJI[mood?.level ?? 0]} ${MOOD_LABEL[mood?.level ?? 0]}`}
            {s.demoMode ? ' · DEMO' : ''}
          </div>
        </div>
      </div>
      <div className="col" style={{ marginTop: 10 }}>
        <button className={`btn ${s.disabled ? 'primary' : ''}`} onClick={() => store.update('settings', { disabled: !s.disabled })}>
          {s.disabled ? '▶ Enable the companion' : '⏸ Disable the companion'}
        </button>
        {s.hiddenSites.length > 0 && (
          <button className="btn" onClick={() => store.update('settings', { hiddenSites: [] })}>🙉 Un-hide on {s.hiddenSites.length} site(s)</button>
        )}
        <button className="btn" onClick={() => send('demo:set', { enabled: !s.demoMode })}>🎭 Demo Mode: {s.demoMode ? 'ON' : 'off'}</button>
        <button className="btn" onClick={() => send('dev:openOptions', {})}>⚙️ Settings</button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Popup />);
