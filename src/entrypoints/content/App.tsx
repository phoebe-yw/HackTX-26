import { useEffect, useState } from 'react';
import { hostnameOf, matchesSiteList } from '@/core/util';
import { useNow, useStored } from '@/ui/hooks';
import { LockdownOverlay, UnlockBurst } from '@/ui/lockdown/LockdownOverlay';
import { Widget } from '@/ui/widget/Widget';

export function App({ onHidden }: { onHidden: () => void }) {
  const [settings] = useStored('settings');
  const [lockdown] = useStored('lockdown');
  const [mood] = useStored('mood');
  const [hiddenNow, setHiddenNow] = useState(false);
  const now = useNow(400);
  // Glass-slipper burst only right after an unlock (not on every page load)
  const burst = Boolean(mood && mood.lastUnlockAt > 0 && now - mood.lastUnlockAt < 1600);

  // If the user re-enables / un-hides from settings, the widget comes back without reload
  useEffect(() => {
    if (!settings) return;
    const host = hostnameOf(location.href);
    const hidden = settings.disabled || matchesSiteList(location.href, settings.hiddenSites) || host === '';
    setHiddenNow(hidden);
  }, [settings]);

  if (!settings) return null;

  return (
    <>
      {lockdown?.active && !settings.disabled && <LockdownOverlay settings={settings} lockdown={lockdown} />}
      {burst && <UnlockBurst />}
      {!hiddenNow && !lockdown?.active && <Widget onHidden={onHidden} />}
    </>
  );
}
