// Character art with a swappable pipeline:
//   1) If /assets/characters/<id>/meta.json says hasArt:true → render the PNG for the pose
//   2) Otherwise → built-in SVG placeholder (distinct per character, expressive per pose)
import { useEffect, useState } from 'react';
import type { CharacterId, Pose } from '@/core/types';
import { CHARACTERS } from '@/data/characters';
import { assetUrl } from '@/core/util';

interface Meta {
  hasArt?: boolean;
}
const metaCache = new Map<CharacterId, Promise<Meta>>();
function loadMeta(id: CharacterId): Promise<Meta> {
  let p = metaCache.get(id);
  if (!p) {
    p = fetch(assetUrl(`/assets/characters/${id}/meta.json`))
      .then((r) => (r.ok ? (r.json() as Promise<Meta>) : {}))
      .catch(() => ({}));
    metaCache.set(id, p);
  }
  return p;
}

export function CharacterArt({
  id,
  pose,
  size = 96,
  className,
}: {
  id: CharacterId;
  pose: Pose;
  size?: number;
  className?: string;
}) {
  const [hasArt, setHasArt] = useState(false);
  useEffect(() => {
    let alive = true;
    loadMeta(id).then((m) => alive && setHasArt(Boolean(m.hasArt)));
    return () => {
      alive = false;
    };
  }, [id]);

  if (hasArt) {
    return (
      <img
        src={assetUrl(`/assets/characters/${id}/${pose}.png`)}
        width={size}
        height={size}
        alt={CHARACTERS[id].name}
        className={className}
        style={{ display: 'block', objectFit: 'contain' }}
        draggable={false}
      />
    );
  }
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', overflow: 'visible' }}
      aria-label={`${CHARACTERS[id].name} (${pose})`}
    >
      {renderBody(id, pose)}
    </svg>
  );
}

// ---------------- shared face ----------------
type FaceMood = 'happy' | 'suspicious' | 'annoyed' | 'furious' | 'sleeping' | 'celebrate';
function faceMood(pose: Pose): FaceMood {
  if (pose === 'idle') return 'happy';
  return pose;
}

function Face({
  cx,
  cy,
  mood,
  scale = 1,
  eyeColor = '#3D2E1A',
  cheek = '#e89aa5',
  mouth = true,
}: {
  cx: number;
  cy: number;
  mood: FaceMood;
  scale?: number;
  eyeColor?: string;
  cheek?: string;
  /** Characters with a beak/bill draw their own mouth */
  mouth?: boolean;
}) {
  const s = scale;
  const ex = 9 * s; // eye offset
  const ey = -2 * s;
  const eyeR = 3.2 * s;
  const elems: React.ReactNode[] = [];

  // eyes
  if (mood === 'sleeping') {
    elems.push(
      <path key="le" d={`M${cx - ex - 3 * s},${cy + ey} q${3 * s},${3 * s} ${6 * s},0`} stroke={eyeColor} strokeWidth={2 * s} fill="none" strokeLinecap="round" />,
      <path key="re" d={`M${cx + ex - 3 * s},${cy + ey} q${3 * s},${3 * s} ${6 * s},0`} stroke={eyeColor} strokeWidth={2 * s} fill="none" strokeLinecap="round" />,
      <text key="z" x={cx + 18 * s} y={cy - 14 * s} fontSize={10 * s} fill={eyeColor} fontFamily="Georgia" fontWeight="bold">z</text>,
      <text key="z2" x={cx + 24 * s} y={cy - 22 * s} fontSize={7 * s} fill={eyeColor} fontFamily="Georgia" fontWeight="bold">z</text>,
    );
  } else if (mood === 'celebrate') {
    elems.push(
      <path key="le" d={`M${cx - ex - 3.5 * s},${cy + ey + 1} q${3.5 * s},${-5 * s} ${7 * s},0`} stroke={eyeColor} strokeWidth={2.2 * s} fill="none" strokeLinecap="round" />,
      <path key="re" d={`M${cx + ex - 3.5 * s},${cy + ey + 1} q${3.5 * s},${-5 * s} ${7 * s},0`} stroke={eyeColor} strokeWidth={2.2 * s} fill="none" strokeLinecap="round" />,
    );
  } else {
    const lookX = mood === 'suspicious' ? 1.6 * s : 0;
    const squint = mood === 'suspicious' ? 0.7 : mood === 'annoyed' ? 0.75 : 1;
    elems.push(
      <g key="eyes" style={{ transformOrigin: `${cx}px ${cy + ey}px`, animation: 'blink-eye 5s infinite' }}>
        <ellipse cx={cx - ex} cy={cy + ey} rx={eyeR} ry={eyeR * squint} fill={eyeColor} />
        <ellipse cx={cx + ex} cy={cy + ey} rx={eyeR} ry={eyeR * squint} fill={eyeColor} />
        <circle cx={cx - ex + 1 * s + lookX} cy={cy + ey - 1 * s} r={1 * s} fill="#fff" />
        <circle cx={cx + ex + 1 * s + lookX} cy={cy + ey - 1 * s} r={1 * s} fill="#fff" />
      </g>,
    );
  }

  // brows
  const bw = 2.2 * s;
  if (mood === 'suspicious') {
    elems.push(
      <path key="lb" d={`M${cx - ex - 4 * s},${cy + ey - 7 * s} l${8 * s},${-2.5 * s}`} stroke={eyeColor} strokeWidth={bw} strokeLinecap="round" />,
      <path key="rb" d={`M${cx + ex - 4 * s},${cy + ey - 6 * s} l${8 * s},${1 * s}`} stroke={eyeColor} strokeWidth={bw} strokeLinecap="round" />,
    );
  } else if (mood === 'annoyed') {
    elems.push(
      <path key="lb" d={`M${cx - ex - 4 * s},${cy + ey - 6.5 * s} l${8 * s},${0}`} stroke={eyeColor} strokeWidth={bw} strokeLinecap="round" />,
      <path key="rb" d={`M${cx + ex - 4 * s},${cy + ey - 6.5 * s} l${8 * s},${0}`} stroke={eyeColor} strokeWidth={bw} strokeLinecap="round" />,
    );
  } else if (mood === 'furious') {
    elems.push(
      <path key="lb" d={`M${cx - ex - 4.5 * s},${cy + ey - 8.5 * s} l${9 * s},${4 * s}`} stroke={eyeColor} strokeWidth={bw * 1.2} strokeLinecap="round" />,
      <path key="rb" d={`M${cx + ex - 4.5 * s},${cy + ey - 4.5 * s} l${9 * s},${-4 * s}`} stroke={eyeColor} strokeWidth={bw * 1.2} strokeLinecap="round" />,
      // steam puffs
      <g key="steam" fill="#fff" opacity={0.9}>
        <circle cx={cx - 22 * s} cy={cy - 16 * s} r={3 * s} />
        <circle cx={cx - 26 * s} cy={cy - 20 * s} r={2 * s} />
        <circle cx={cx + 22 * s} cy={cy - 16 * s} r={3 * s} />
        <circle cx={cx + 26 * s} cy={cy - 20 * s} r={2 * s} />
      </g>,
    );
  }

  // cheeks
  if (mood === 'happy' || mood === 'celebrate' || mood === 'furious') {
    elems.push(
      <ellipse key="lc" cx={cx - 13 * s} cy={cy + 5 * s} rx={3.5 * s} ry={2 * s} fill={mood === 'furious' ? '#e0576f' : cheek} opacity={0.7} />,
      <ellipse key="rc" cx={cx + 13 * s} cy={cy + 5 * s} rx={3.5 * s} ry={2 * s} fill={mood === 'furious' ? '#e0576f' : cheek} opacity={0.7} />,
    );
  }

  // mouth
  const my = cy + 7 * s;
  if (!mouth) return <g>{elems}</g>;
  switch (mood) {
    case 'happy':
      elems.push(<path key="m" d={`M${cx - 5 * s},${my} q${5 * s},${5 * s} ${10 * s},0`} stroke={eyeColor} strokeWidth={2 * s} fill="none" strokeLinecap="round" />);
      break;
    case 'celebrate':
      elems.push(<path key="m" d={`M${cx - 7 * s},${my - 1} q${7 * s},${9 * s} ${14 * s},0 z`} fill="#7a2a3a" stroke={eyeColor} strokeWidth={1.5 * s} />);
      break;
    case 'suspicious':
      elems.push(<path key="m" d={`M${cx - 4 * s},${my + 1} l${8 * s},${-1.5 * s}`} stroke={eyeColor} strokeWidth={2 * s} strokeLinecap="round" />);
      break;
    case 'annoyed':
      elems.push(<path key="m" d={`M${cx - 5 * s},${my + 2} q${5 * s},${-4 * s} ${10 * s},0`} stroke={eyeColor} strokeWidth={2 * s} fill="none" strokeLinecap="round" />);
      break;
    case 'furious':
      elems.push(<path key="m" d={`M${cx - 6 * s},${my} q${6 * s},${-2 * s} ${12 * s},0 q${-6 * s},${8 * s} ${-12 * s},0 z`} fill="#7a2a3a" stroke={eyeColor} strokeWidth={1.5 * s} />);
      break;
    case 'sleeping':
      elems.push(<circle key="m" cx={cx} cy={my + 1} r={1.6 * s} fill={eyeColor} />);
      break;
  }
  return <g>{elems}</g>;
}

function Sparkles({ cx, cy }: { cx: number; cy: number }) {
  const pts = [
    [-34, -30],
    [34, -26],
    [-30, 10],
    [36, 14],
    [0, -42],
  ];
  return (
    <g fill="#D9B44A">
      {pts.map(([dx, dy], i) => (
        <path
          key={i}
          d={`M${cx + dx},${cy + dy - 5} l1.5,3.5 l3.5,1.5 l-3.5,1.5 l-1.5,3.5 l-1.5,-3.5 l-3.5,-1.5 l3.5,-1.5 z`}
          style={{ transformOrigin: `${cx + dx}px ${cy + dy}px`, animation: `sparkle 1.2s ${i * 0.15}s ease-out infinite` }}
        />
      ))}
    </g>
  );
}

// ---------------- bodies ----------------
function renderBody(id: CharacterId, pose: Pose) {
  const mood = faceMood(pose);
  const furious = mood === 'furious';
  switch (id) {
    case 'red':
      return (
        <g>
          {/* hood */}
          <path d="M50 14 C 24 14, 16 40, 18 66 L 82 66 C 84 40, 76 14, 50 14 Z" fill="#A3304A" stroke="#3D2E1A" strokeWidth="2.5" />
          {/* cape */}
          <path d="M18 66 Q 50 60 82 66 L 90 92 Q 50 86 10 92 Z" fill="#8c2740" stroke="#3D2E1A" strokeWidth="2.5" />
          {/* face */}
          <ellipse cx="50" cy="48" rx="22" ry="23" fill="#f7d9c4" stroke="#3D2E1A" strokeWidth="2.5" />
          {/* hair peek */}
          <path d="M30 40 q10 -14 40 0 q-6 -8 -20 -9 q-14 1 -20 9 z" fill="#5a3b1e" />
          <Face cx={50} cy={50} mood={mood} />
          {/* bow */}
          <g transform="translate(50 74)">
            <path d="M-9 -4 L0 0 L-9 4 Z" fill="#D9B44A" stroke="#3D2E1A" strokeWidth="1.5" />
            <path d="M9 -4 L0 0 L9 4 Z" fill="#D9B44A" stroke="#3D2E1A" strokeWidth="1.5" />
            <circle r="2.5" fill="#3D2E1A" />
          </g>
          {/* basket */}
          <g transform="translate(80 80)">
            <path d="M-10 0 h20 l-3 12 h-14 z" fill="#c99a52" stroke="#3D2E1A" strokeWidth="1.5" />
            <path d="M-6 0 q6 -10 12 0" fill="none" stroke="#3D2E1A" strokeWidth="1.5" />
          </g>
          {mood === 'celebrate' && <Sparkles cx={50} cy={48} />}
        </g>
      );
    case 'cinderella':
      return (
        <g>
          {/* gown */}
          <path d="M50 58 C 30 62, 18 80, 12 96 L 88 96 C 82 80, 70 62, 50 58 Z" fill="#8EB9CC" stroke="#3D2E1A" strokeWidth="2.5" />
          <path d="M50 60 L 42 96 M50 60 L 58 96" stroke="#6f9db2" strokeWidth="1.5" />
          {/* neck/shoulders */}
          <rect x="44" y="52" width="12" height="10" rx="4" fill="#f7d9c4" stroke="#3D2E1A" strokeWidth="2" />
          {/* hair bun */}
          <circle cx="50" cy="20" r="9" fill="#e8c86b" stroke="#3D2E1A" strokeWidth="2" />
          {/* face */}
          <ellipse cx="50" cy="38" rx="20" ry="21" fill="#f7d9c4" stroke="#3D2E1A" strokeWidth="2.5" />
          <path d="M31 36 q8 -18 38 0 q-4 -12 -19 -13 q-15 1 -19 13 z" fill="#e8c86b" />
          {/* tiara */}
          <path d="M38 22 l4 -6 l4 5 l4 -8 l4 8 l4 -5 l4 6 z" fill="#D9B44A" stroke="#3D2E1A" strokeWidth="1.5" />
          <Face cx={50} cy={40} mood={mood} scale={0.9} />
          {/* tiny clock */}
          <g transform="translate(82 30)">
            <circle r="8" fill="#fff" stroke="#3D2E1A" strokeWidth="1.5" />
            <path d="M0 -5 V0 L3.5 2" stroke="#3D2E1A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </g>
          {mood === 'celebrate' && <Sparkles cx={50} cy={40} />}
        </g>
      );
    case 'wolf':
      return (
        <g>
          {/* ears */}
          <path d="M26 34 L 20 8 L 42 24 Z" fill="#6b6f66" stroke="#3D2E1A" strokeWidth="2.5" />
          <path d="M74 34 L 80 8 L 58 24 Z" fill="#6b6f66" stroke="#3D2E1A" strokeWidth="2.5" />
          <path d="M28 30 L 25 15 L 38 25 Z" fill="#d8a0a8" />
          <path d="M72 30 L 75 15 L 62 25 Z" fill="#d8a0a8" />
          {/* head */}
          <ellipse cx="50" cy="48" rx="28" ry="26" fill="#7e8279" stroke="#3D2E1A" strokeWidth="2.5" />
          {/* fluffy cheeks */}
          <path d="M22 50 q-8 10 2 16 M78 50 q8 10 -2 16" fill="none" stroke="#3D2E1A" strokeWidth="2.5" strokeLinecap="round" />
          {/* snout */}
          <ellipse cx="50" cy="62" rx="14" ry="10" fill="#c9c6bb" stroke="#3D2E1A" strokeWidth="2" />
          <ellipse cx="50" cy="57" rx="4.5" ry="3.5" fill="#3D2E1A" />
          {/* teeth when furious */}
          {furious && (
            <g fill="#fff" stroke="#3D2E1A" strokeWidth="1">
              <path d="M42 66 l2 6 l2 -6 z" />
              <path d="M54 66 l2 6 l2 -6 z" />
            </g>
          )}
          <Face cx={50} cy={46} mood={mood} scale={0.95} eyeColor={furious ? '#7a1b1b' : '#3D2E1A'} cheek="#b08088" />
          {/* body hint */}
          <path d="M26 76 q24 -10 48 0 l6 20 h-60 z" fill="#6b6f66" stroke="#3D2E1A" strokeWidth="2.5" />
          {mood === 'celebrate' && <Sparkles cx={50} cy={48} />}
        </g>
      );
    case 'duck':
      return (
        <g>
          {/* body */}
          <ellipse cx="50" cy="70" rx="30" ry="22" fill="#f2cf5b" stroke="#3D2E1A" strokeWidth="2.5" />
          {/* wing */}
          <path d="M28 70 q12 -4 22 6 q-12 8 -22 -6 z" fill="#e0b944" stroke="#3D2E1A" strokeWidth="2" />
          {/* head */}
          <circle cx="56" cy="38" r="20" fill="#f2cf5b" stroke="#3D2E1A" strokeWidth="2.5" />
          {/* tuft */}
          <path d="M50 19 q4 -8 10 -2 q2 -6 8 -2" fill="none" stroke="#3D2E1A" strokeWidth="2" strokeLinecap="round" />
          <Face cx={56} cy={36} mood={mood} scale={0.85} mouth={false} />
          {/* bill (it is the mouth): open when yelling or cheering, tilted when suspicious */}
          {furious || mood === 'celebrate' ? (
            <g stroke="#3D2E1A" strokeWidth="2" strokeLinejoin="round">
              <path d="M47 46 q9 12 18 0 z" fill="#7a2a3a" />
              <path d="M43 44 q13 -6 26 0 q-4 4 -13 4 q-9 0 -13 -4 z" fill="#e8893a" />
              <path d="M47 50 q9 9 18 0 q-9 3 -18 0 z" fill="#d9772c" />
            </g>
          ) : (
            <g transform={mood === 'suspicious' ? 'rotate(-7 56 46)' : undefined}>
              <path d="M43 44 q13 -6 26 0 q-3 7 -13 7 q-10 0 -13 -7 z" fill="#e8893a" stroke="#3D2E1A" strokeWidth="2" strokeLinejoin="round" />
              <path d="M45 46 q11 3 22 0" fill="none" stroke="#3D2E1A" strokeWidth="1.2" strokeLinecap="round" opacity={0.6} />
              <circle cx="52" cy="43" r="0.9" fill="#3D2E1A" />
              <circle cx="60" cy="43" r="0.9" fill="#3D2E1A" />
            </g>
          )}
          {/* feet */}
          <path d="M40 92 l-6 5 h12 z M60 92 l-6 5 h12 z" fill="#e8893a" stroke="#3D2E1A" strokeWidth="1.5" />
          {mood === 'celebrate' && <Sparkles cx={56} cy={40} />}
        </g>
      );
    case 'humpty':
      return (
        <g>
          {/* wall */}
          <g fill="#b87a5a" stroke="#3D2E1A" strokeWidth="1.5">
            <rect x="8" y="84" width="84" height="14" />
            <path d="M8 91 h84 M29 84 v7 M50 84 v7 M71 84 v7 M18 91 v7 M40 91 v7 M61 91 v7 M82 91 v7" fill="none" />
          </g>
          {/* legs */}
          <path d="M40 80 v8 M60 80 v8" stroke="#3D2E1A" strokeWidth="3" strokeLinecap="round" />
          {/* egg */}
          <path d="M50 10 C 30 10, 24 42, 26 60 C 28 78, 40 86, 50 86 C 60 86, 72 78, 74 60 C 76 42, 70 10, 50 10 Z" fill="#fbf3dc" stroke="#3D2E1A" strokeWidth="2.5" />
          {/* belt / pants */}
          <path d="M27 62 q23 8 46 0 L 72 72 q-22 8 -44 0 z" fill="#5B6236" stroke="#3D2E1A" strokeWidth="2" />
          {/* bow tie */}
          <g transform="translate(50 60)">
            <path d="M-7 -3 L0 0 L-7 3 Z M7 -3 L0 0 L7 3 Z" fill="#A3304A" stroke="#3D2E1A" strokeWidth="1.2" />
          </g>
          {/* crack when annoyed/furious */}
          {(mood === 'annoyed' || furious) && (
            <path d="M36 26 l5 6 l-4 5 l6 6 l-3 5" fill="none" stroke="#3D2E1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {furious && <path d="M64 22 l-4 7 l5 4 l-5 7" fill="none" stroke="#3D2E1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
          <Face cx={50} cy={40} mood={mood} />
          {mood === 'celebrate' && <Sparkles cx={50} cy={40} />}
        </g>
      );
  }
}

export function poseForLevel(level: number, opts: { celebrating?: boolean; sleeping?: boolean } = {}): Pose {
  if (opts.celebrating) return 'celebrate';
  if (opts.sleeping) return 'sleeping';
  switch (level) {
    case 1:
      return 'suspicious';
    case 2:
      return 'annoyed';
    case 3:
    case 4:
      return 'furious';
    default:
      return 'idle';
  }
}
