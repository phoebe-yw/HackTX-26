import { useEffect, useMemo, useState } from 'react';
import type { Challenge, FriendChallenge, OathChallenge, QuizChallenge, RiddleChallenge } from '@/core/types';
import { normalizeAnswer } from '@/core/util';

interface Props<T extends Challenge> {
  challenge: T;
  onSolved: () => void;
  onFailed: () => void;
}

export function ChallengeView({ challenge, onSolved, onFailed }: Props<Challenge>) {
  switch (challenge.type) {
    case 'riddle':
      return <Riddle challenge={challenge} onSolved={onSolved} onFailed={onFailed} />;
    case 'quiz':
      return <Quiz challenge={challenge} onSolved={onSolved} onFailed={onFailed} />;
    case 'oath':
      return <Oath challenge={challenge} onSolved={onSolved} onFailed={onFailed} />;
    case 'friend':
      return <Friend challenge={challenge} onSolved={onSolved} onFailed={onFailed} />;
  }
}

function matches(input: string, answers: string[]): boolean {
  const n = normalizeAnswer(input);
  if (!n) return false;
  return answers.some((a) => {
    const na = normalizeAnswer(a);
    return n === na || n === `a ${na}` || n === `the ${na}` || na === `a ${n}` || na === `the ${n}`;
  });
}

function TypedAnswer({ answers, placeholder, onSolved, onFailed, hint }: { answers: string[]; placeholder: string; onSolved: () => void; onFailed: () => void; hint?: string }) {
  const [val, setVal] = useState('');
  const [tries, setTries] = useState(0);
  const [shake, setShake] = useState(false);
  function submit() {
    if (matches(val, answers)) onSolved();
    else {
      setTries((t) => t + 1);
      setShake(true);
      setTimeout(() => setShake(false), 600);
      onFailed();
    }
  }
  return (
    <div className="col">
      <div className={`row ${shake ? 'anim-shake' : ''}`}>
        <input
          className="input"
          autoFocus
          placeholder={placeholder}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button className="btn primary" onClick={submit}>Answer</button>
      </div>
      {tries >= 2 && hint && <div className="small muted">Hint: {hint}</div>}
      {tries >= 4 && <div className="small muted">Still stuck? Ask for a different trial below.</div>}
    </div>
  );
}

function Riddle({ challenge, onSolved, onFailed }: Props<RiddleChallenge>) {
  return (
    <>
      <div className="lock-prompt">🧩 {challenge.prompt}</div>
      <TypedAnswer answers={challenge.answers} placeholder="Your answer…" onSolved={onSolved} onFailed={onFailed} hint={challenge.hint} />
    </>
  );
}

function Friend({ challenge, onSolved, onFailed }: Props<FriendChallenge>) {
  return (
    <>
      <div className="small muted">⚔️ A challenge from <b>{challenge.fromName}</b>:</div>
      <div className="lock-prompt">{challenge.prompt}</div>
      <TypedAnswer answers={challenge.answers} placeholder="Prove it…" onSolved={onSolved} onFailed={onFailed} />
    </>
  );
}

function Quiz({ challenge, onSolved, onFailed }: Props<QuizChallenge>) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const q = challenge.questions[i];
  useEffect(() => {
    setPicked(null);
  }, [i]);
  if (!q) return null;
  function pick(idx: number) {
    if (picked !== null) return;
    setPicked(idx);
    const correct = idx === q.correctIndex;
    if (!correct) onFailed();
    setTimeout(() => {
      if (correct) {
        if (i + 1 >= challenge.questions.length) onSolved();
        else setI(i + 1);
      } else setPicked(null);
    }, 900);
  }
  return (
    <>
      <div className="small muted">
        📚 Study trial · question {i + 1} of {challenge.questions.length}
      </div>
      <div className="lock-prompt">{q.question}</div>
      <div className="lock-options">
        {q.options.map((o, idx) => (
          <button
            key={idx}
            className={`btn ${picked === idx ? (idx === q.correctIndex ? 'correct' : 'wrong') : ''}`}
            onClick={() => pick(idx)}
          >
            <b>{String.fromCharCode(65 + idx)}.</b> {o}
          </button>
        ))}
      </div>
    </>
  );
}

function Oath({ challenge, onSolved, onFailed }: Props<OathChallenge>) {
  const target = useMemo(
    () => (challenge.backwards ? challenge.text.split('').reverse().join('') : challenge.text),
    [challenge],
  );
  const [val, setVal] = useState('');
  const ok = val === target;
  const prefixOk = target.startsWith(val);
  useEffect(() => {
    if (ok) {
      const t = setTimeout(onSolved, 300);
      return () => clearTimeout(t);
    }
  }, [ok, onSolved]);
  return (
    <>
      <div className="small muted">
        ✍️ Type the oath <b>exactly</b>
        {challenge.backwards ? ' — BACKWARDS (Big Bad Wolf mode)' : ''}:
      </div>
      <div className="oath-target">
        {target.split('').map((ch, idx) => {
          const typed = idx < val.length;
          const good = typed && val[idx] === ch;
          return (
            <span key={idx} className={typed ? (good ? 'ok' : 'bad') : ''}>
              {ch}
            </span>
          );
        })}
      </div>
      <input
        className="input"
        autoFocus
        value={val}
        placeholder="Start typing…"
        onChange={(e) => setVal(e.target.value)}
        onPaste={(e) => {
          e.preventDefault();
          onFailed();
        }}
        style={{ borderColor: val && !prefixOk ? 'var(--crimson)' : undefined }}
      />
      {val && !prefixOk && <div className="small" style={{ color: 'var(--crimson)' }}>That's not the oath. Backspace and try again.</div>}
    </>
  );
}
