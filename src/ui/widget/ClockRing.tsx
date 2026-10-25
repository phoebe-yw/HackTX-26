// Cinderella's clock: a ring that fills as the phase elapses; strikes at midnight (phase end).
import { useFlash } from '../hooks';

const NUMERALS = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

export function ClockRing({
  progress, // 0..1 elapsed
  label,
  sub,
  strikeSeq,
  color = 'var(--gold)',
  size = 170,
}: {
  progress: number;
  label: string;
  sub: string;
  strikeSeq: number;
  color?: string;
  size?: number;
}) {
  const striking = useFlash(strikeSeq, 1300);
  const r = 70;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  const handAngle = p * 360;
  return (
    <div className={`clock-wrap ${striking ? 'strike' : ''}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 170 170" width={size} height={size} style={{ display: 'block' }}>
        <defs>
          <radialGradient id="face" cx="50%" cy="40%">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="100%" stopColor="#f3ecd8" />
          </radialGradient>
        </defs>
        <circle cx="85" cy="85" r="80" fill="url(#face)" stroke="var(--ink)" strokeWidth="3" />
        <circle cx="85" cy="85" r={r} fill="none" stroke="rgba(61,46,26,0.15)" strokeWidth="8" />
        <circle
          cx="85"
          cy="85"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          transform="rotate(-90 85 85)"
          style={{ transition: 'stroke-dashoffset 0.9s linear' }}
        />
        {NUMERALS.map((n, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          const x = 85 + Math.cos(a) * 54;
          const y = 85 + Math.sin(a) * 54 + 4;
          return (
            <text key={n} x={x} y={y} textAnchor="middle" fontSize="10" fontFamily="Georgia, serif" fill="var(--ink)" fontWeight="bold">
              {n}
            </text>
          );
        })}
        {/* hour hand points to midnight, minute hand sweeps */}
        <line x1="85" y1="85" x2="85" y2="48" stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round" />
        <line
          x1="85"
          y1="85"
          x2="85"
          y2="36"
          stroke="var(--crimson)"
          strokeWidth="2.5"
          strokeLinecap="round"
          transform={`rotate(${handAngle} 85 85)`}
          style={{ transition: 'transform 0.9s linear' }}
        />
        <circle cx="85" cy="85" r="4" fill="var(--ink)" />
        {striking && (
          <g fill="var(--gold)" style={{ animation: 'sparkle 1.2s ease-out' }}>
            <circle cx="30" cy="30" r="4" />
            <circle cx="140" cy="30" r="4" />
            <circle cx="30" cy="140" r="4" />
            <circle cx="140" cy="140" r="4" />
          </g>
        )}
      </svg>
      <div className="clock-time" style={{ paddingTop: 40 }}>
        <div className="t">{label}</div>
        <div className="p">{sub}</div>
      </div>
    </div>
  );
}
