import { useState } from 'react';
import { send } from '@/core/messaging';
import type { Settings } from '@/core/types';
import { QUOTES } from '@/data/curated';
import { CHARACTERS } from '@/data/characters';
import { ProviderBadge } from '../../components/ProviderBadge';

export function QuotesPage({ settings }: { settings: Settings }) {
  const list = QUOTES[settings.characterId];
  const [i, setI] = useState(() => Math.floor(Math.random() * list.length));
  const [ai, setAi] = useState<{ text: string; provider: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const c = CHARACTERS[settings.characterId];

  async function conjure() {
    setBusy(true);
    try {
      setAi(await send('ai:quote', {}));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="col">
      <div className="display" style={{ fontSize: 18 }}>📜 Words from {settings.petName || c.name}</div>
      <div className="parchment quote-card anim-flip" key={ai ? ai.text : i}>
        <div>
          <div className="mark">“</div>
          {ai ? ai.text : list[i]}
          <div className="mark">”</div>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button
          className="btn sm"
          onClick={() => {
            setAi(null);
            setI((v) => (v + 1) % list.length);
          }}
        >
          Next page →
        </button>
        <button className="btn sm primary" disabled={busy} onClick={conjure} title="Have the AI write one for your topic">
          {busy ? 'conjuring…' : '✦ Conjure one'}
        </button>
      </div>
      <div className="center">{ai && <ProviderBadge provider={ai.provider} />}</div>
    </div>
  );
}
