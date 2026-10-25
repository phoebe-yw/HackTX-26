import { send } from '@/core/messaging';
import { phaseDurationMs, remainingMs } from '@/core/session';
import type { LockdownState, MoodState, Pose, SessionState, Settings } from '@/core/types';
import { fmtClock, fmtDuration } from '@/core/util';
import { CHARACTERS, MOOD_EMOJI, MOOD_LABEL } from '@/data/characters';
import { CharacterArt } from '../../components/CharacterArt';
import { ClockRing } from '../ClockRing';

export function HomePage({
  settings,
  session,
  mood,
  pose,
  now,
  bubbleText,
  bubbleKind,
}: {
  settings: Settings;
  session: SessionState;
  mood: MoodState;
  lockdown: LockdownState;
  pose: Pose;
  now: number;
  bubbleText: string | null;
  bubbleKind: string;
}) {
  const c = CHARACTERS[settings.characterId];
  const total = phaseDurationMs(session.status, settings);
  const remaining = remainingMs(session, now);
  const progress = total > 0 ? 1 - remaining / total : 0;
  const phaseLabel =
    session.status === 'idle'
      ? 'asleep'
      : session.status === 'focus'
        ? session.paused
          ? 'paused'
          : 'focus'
        : session.status === 'break'
          ? 'break'
          : 'long break';
  const timeLabel =
    session.status === 'idle'
      ? '—'
      : total === 0
        ? fmtClock(now - session.phaseStartedAt)
        : fmtClock(remaining);
  const ringColor =
    session.status === 'focus' ? 'var(--gold)' : session.status === 'idle' ? 'var(--sage)' : 'var(--powder)';

  const animClass = pose === 'furious' ? 'anim-rage' : pose === 'annoyed' ? 'anim-wobble' : pose === 'sleeping' ? '' : 'anim-bob';

  return (
    <div className="home">
      <div className="stage">
        {bubbleText && <div className={`bubble ${bubbleKind}`}>{bubbleText}</div>}
        <div className={animClass} style={{ marginTop: bubbleText ? 34 : 0 }}>
          <CharacterArt id={settings.characterId} pose={pose} size={96} />
        </div>
      </div>
      <div className={`mood-label l${mood.level}`}>
        {MOOD_EMOJI[mood.level]} {settings.petName || c.name} is {session.status === 'idle' ? 'napping' : MOOD_LABEL[mood.level].toLowerCase()}
      </div>

      <ClockRing progress={progress} label={timeLabel} sub={phaseLabel} strikeSeq={session.strikeSeq} color={ringColor} />

      <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        {session.status === 'idle' ? (
          <button className="btn primary" onClick={() => send('session:start', {})}>
            ✦ Begin the chapter
          </button>
        ) : (
          <>
            {session.paused ? (
              <button className="btn primary sm" onClick={() => send('session:resume', {})}>▶ Resume</button>
            ) : (
              <button className="btn sm" onClick={() => send('session:pause', {})}>❚❚ Pause</button>
            )}
            {total > 0 && (
              <button className="btn sm" onClick={() => send('session:skip', {})} title="Skip to next phase">
                ⏭ Skip
              </button>
            )}
            <button className="btn sm danger" onClick={() => send('session:stop', {})}>■ End</button>
          </>
        )}
      </div>

      <div className="small muted center">
        {settings.topic ? <>Studying <b>{settings.topic}</b> · </> : null}
        {settings.method.id === 'none' ? 'no timer' : `${settings.method.focusMin}/${settings.method.breakMin}`}
        {' · '}today {fmtDuration(session.focusMsToday + (session.status === 'focus' && !session.paused ? now - session.phaseStartedAt : 0))}
        {settings.demoMode && <span className="chip bad" style={{ marginLeft: 6 }}>DEMO</span>}
      </div>
    </div>
  );
}
