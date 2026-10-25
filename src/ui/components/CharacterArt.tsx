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
  lineColor,
}: {
  cx: number;
  cy: number;
  mood: FaceMood;
  scale?: number;
  eyeColor?: string;
  cheek?: string;
  /** Characters with a beak/bill draw their own mouth */
  mouth?: boolean;
  /** Brows + mouth colour, for dark-furred faces (defaults to eyeColor) */
  lineColor?: string;
}) {
  const s = scale;
  const ink = lineColor ?? eyeColor;
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
      <path key="lb" d={`M${cx - ex - 4 * s},${cy + ey - 7 * s} l${8 * s},${-2.5 * s}`} stroke={ink} strokeWidth={bw} strokeLinecap="round" />,
      <path key="rb" d={`M${cx + ex - 4 * s},${cy + ey - 6 * s} l${8 * s},${1 * s}`} stroke={ink} strokeWidth={bw} strokeLinecap="round" />,
    );
  } else if (mood === 'annoyed') {
    elems.push(
      <path key="lb" d={`M${cx - ex - 4 * s},${cy + ey - 6.5 * s} l${8 * s},${0}`} stroke={ink} strokeWidth={bw} strokeLinecap="round" />,
      <path key="rb" d={`M${cx + ex - 4 * s},${cy + ey - 6.5 * s} l${8 * s},${0}`} stroke={ink} strokeWidth={bw} strokeLinecap="round" />,
    );
  } else if (mood === 'furious') {
    elems.push(
      <path key="lb" d={`M${cx - ex - 4.5 * s},${cy + ey - 8.5 * s} l${9 * s},${4 * s}`} stroke={ink} strokeWidth={bw * 1.2} strokeLinecap="round" />,
      <path key="rb" d={`M${cx + ex - 4.5 * s},${cy + ey - 4.5 * s} l${9 * s},${-4 * s}`} stroke={ink} strokeWidth={bw * 1.2} strokeLinecap="round" />,
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
      elems.push(<path key="m" d={`M${cx - 5 * s},${my} q${5 * s},${5 * s} ${10 * s},0`} stroke={ink} strokeWidth={2 * s} fill="none" strokeLinecap="round" />);
      break;
    case 'celebrate':
      elems.push(<path key="m" d={`M${cx - 7 * s},${my - 1} q${7 * s},${9 * s} ${14 * s},0 z`} fill="#7a2a3a" stroke={ink} strokeWidth={1.5 * s} />);
      break;
    case 'suspicious':
      elems.push(<path key="m" d={`M${cx - 4 * s},${my + 1} l${8 * s},${-1.5 * s}`} stroke={ink} strokeWidth={2 * s} strokeLinecap="round" />);
      break;
    case 'annoyed':
      elems.push(<path key="m" d={`M${cx - 5 * s},${my + 2} q${5 * s},${-4 * s} ${10 * s},0`} stroke={ink} strokeWidth={2 * s} fill="none" strokeLinecap="round" />);
      break;
    case 'furious':
      elems.push(<path key="m" d={`M${cx - 6 * s},${my} q${6 * s},${-2 * s} ${12 * s},0 q${-6 * s},${8 * s} ${-12 * s},0 z`} fill="#7a2a3a" stroke={ink} strokeWidth={1.5 * s} />);
      break;
    case 'sleeping':
      elems.push(<circle key="m" cx={cx} cy={my + 1} r={1.6 * s} fill={ink} />);
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
    case 'poseidon':
      return (
        <g>
          {/* trident (behind the arm, in front of the robe) */}
          <path d="M82 96 V16" stroke="#3D2E1A" strokeWidth="6" strokeLinecap="round" />
          <path d="M82 96 V16" stroke="#D9B44A" strokeWidth="3" strokeLinecap="round" />
          <path d="M72 8 v10 q10 8 20 0 v-10" fill="none" stroke="#3D2E1A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M72 8 v10 q10 8 20 0 v-10" fill="none" stroke="#D9B44A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M82 22 V4" stroke="#3D2E1A" strokeWidth="6" strokeLinecap="round" />
          <path d="M82 22 V4" stroke="#D9B44A" strokeWidth="3" strokeLinecap="round" />
          <g fill="#D9B44A" stroke="#3D2E1A" strokeWidth="1.2" strokeLinejoin="round">
            <path d="M69 9 l3 -7 l3 7 z" />
            <path d="M79 5 l3 -7 l3 7 z" />
            <path d="M89 9 l3 -7 l3 7 z" />
          </g>
          {furious && (
            <g stroke="#F0D78A" strokeWidth="2" strokeLinecap="round">
              <path d="M64 6 l-5 -3 M100 6 l-5 3 M66 18 l-6 1 M98 18 l6 1" />
            </g>
          )}
          {/* robe */}
          <path d="M20 96 C 22 72, 34 62, 48 60 C 62 62, 74 72, 76 96 Z" fill="#8EB9CC" stroke="#3D2E1A" strokeWidth="2.5" />
          <path d="M30 66 L 66 92" stroke="#D9B44A" strokeWidth="4" strokeLinecap="round" />
          {/* hand on the trident */}
          <circle cx="80" cy="64" r="5" fill="#f7d9c4" stroke="#3D2E1A" strokeWidth="2" />
          {/* hair */}
          <path d="M28 40 q-4 -18 10 -24 q10 -6 20 0 q14 6 10 24 z" fill="#eef4f5" stroke="#3D2E1A" strokeWidth="2.2" />
          {/* face */}
          <ellipse cx="48" cy="38" rx="17" ry="18" fill="#f7d9c4" stroke="#3D2E1A" strokeWidth="2.5" />
          {/* sea-foam beard */}
          <path d="M31 42 C 30 60, 40 72, 48 78 C 56 72, 66 60, 65 42 C 60 50, 54 52, 48 52 C 42 52, 36 50, 31 42 Z" fill="#eef4f5" stroke="#3D2E1A" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M40 60 q3 4 0 8 M48 62 q3 4 0 9 M56 60 q3 4 0 8" fill="none" stroke="#8EB9CC" strokeWidth="1.6" strokeLinecap="round" />
          {/* crown */}
          <path d="M34 22 l3 -9 l5 6 l6 -10 l6 10 l5 -6 l3 9 z" fill="#D9B44A" stroke="#3D2E1A" strokeWidth="1.8" strokeLinejoin="round" />
          <Face cx={48} cy={36} mood={mood} scale={0.85} />
          {/* waves */}
          <path d="M2 92 q8 -8 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 V100 H2 Z" fill="#5f9db5" stroke="#3D2E1A" strokeWidth="2" strokeLinejoin="round" />
          {furious && (
            <g fill="#eef4f5" stroke="#3D2E1A" strokeWidth="1">
              <circle cx="10" cy="80" r="2.5" />
              <circle cx="20" cy="74" r="2" />
              <circle cx="90" cy="82" r="2.5" />
            </g>
          )}
          {mood === 'celebrate' && <Sparkles cx={48} cy={40} />}
        </g>
      );
    case 'bat':
      return (
        <g>
          {/* wings */}
          <g fill="#4A3B22" stroke="#2a1f10" strokeWidth="2" strokeLinejoin="round">
            <path d={furious ? 'M40 56 C 30 30, 12 22, 2 26 C 6 34, 6 42, 4 50 C 10 46, 16 48, 18 54 C 22 48, 28 50, 30 56 C 34 52, 38 54, 40 58 Z' : 'M40 56 C 30 38, 14 32, 4 38 C 8 46, 8 54, 6 62 C 12 58, 18 60, 20 66 C 24 60, 30 62, 32 68 C 36 62, 38 62, 40 64 Z'} />
            <path d={furious ? 'M60 56 C 70 30, 88 22, 98 26 C 94 34, 94 42, 96 50 C 90 46, 84 48, 82 54 C 78 48, 72 50, 70 56 C 66 52, 62 54, 60 58 Z' : 'M60 56 C 70 38, 86 32, 96 38 C 92 46, 92 54, 94 62 C 88 58, 82 60, 80 66 C 76 60, 70 62, 68 68 C 64 62, 62 62, 60 64 Z'} />
          </g>
          {/* body + cream chest tuft */}
          <ellipse cx="50" cy="68" rx="14" ry="17" fill="#4A3B22" stroke="#2a1f10" strokeWidth="2" />
          <path d="M43 56 l7 9 l7 -9 q-7 4 -14 0 z" fill="#F3ECD8" />
          {/* feet */}
          <path d="M44 84 l-2 6 M48 85 l0 6 M52 85 l0 6 M56 84 l2 6" stroke="#2a1f10" strokeWidth="2" strokeLinecap="round" />
          {/* ears */}
          <path d="M36 32 L 30 8 L 47 26 Z" fill="#4A3B22" stroke="#2a1f10" strokeWidth="2" strokeLinejoin="round" />
          <path d="M64 32 L 70 8 L 53 26 Z" fill="#4A3B22" stroke="#2a1f10" strokeWidth="2" strokeLinejoin="round" />
          <path d="M37 28 L 33 14 L 44 25 Z" fill="#F3ECD8" />
          <path d="M63 28 L 67 14 L 56 25 Z" fill="#F3ECD8" />
          {/* head */}
          <circle cx="50" cy="40" r="17" fill="#4A3B22" stroke="#2a1f10" strokeWidth="2" />
          {/* big white eyes (the shared face draws the pupils) */}
          {mood !== 'sleeping' && mood !== 'celebrate' && (
            <g fill="#fbf8ee">
              <ellipse cx="42.4" cy="38.3" rx="5" ry="5.2" />
              <ellipse cx="57.6" cy="38.3" rx="5" ry="5.2" />
            </g>
          )}
          {/* closed eyes sit on dark fur, so they're drawn light */}
          <Face cx={50} cy={40} mood={mood} scale={0.85} eyeColor={mood === 'sleeping' || mood === 'celebrate' ? '#F3ECD8' : '#3D2E1A'} lineColor="#F3ECD8" cheek="#c97a86" />
          {/* fangs */}
          <path d="M46 46.5 l1.4 3 l1.4 -3 z M51.2 46.5 l1.4 3 l1.4 -3 z" fill="#fbf8ee" />
          {/* star wand */}
          <path d="M62 78 L 84 56" stroke="#3D2E1A" strokeWidth="5" strokeLinecap="round" />
          <path d="M62 78 L 84 56" stroke="#D9B44A" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="62" cy="77" r="3.5" fill="#4A3B22" stroke="#2a1f10" strokeWidth="1.5" />
          <path d="M86 46 l2.6 5.6 l6 .6 l-4.5 4 l1.3 6 l-5.4 -3.1 l-5.4 3.1 l1.3 -6 l-4.5 -4 l6 -.6 z" fill="#F0D78A" stroke="#3D2E1A" strokeWidth="1.5" strokeLinejoin="round" />
          {(mood === 'happy' || mood === 'celebrate') && (
            <g fill="#D9B44A">
              <path d="M76 36 l1.5 3.5 l3.5 1.5 l-3.5 1.5 l-1.5 3.5 l-1.5 -3.5 l-3.5 -1.5 l3.5 -1.5 z" />
              <path d="M94 34 l1 2.4 l2.4 1 l-2.4 1 l-1 2.4 l-1 -2.4 l-2.4 -1 l2.4 -1 z" />
            </g>
          )}
          {mood === 'celebrate' && <Sparkles cx={50} cy={46} />}
        </g>
      );
    case 'witch':
      return (
        <g>
          {/* cloak */}
          <path d="M22 96 C 24 74, 34 62, 50 60 C 66 62, 76 74, 78 96 Z" fill="#2F3A2A" stroke="#3D2E1A" strokeWidth="2.5" />
          <path d="M42 62 L 50 72 L 58 62" fill="#A3304A" stroke="#3D2E1A" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M50 74 l1.6 3.4 l3.7 .4 l-2.8 2.5 l.8 3.6 l-3.3 -1.9 l-3.3 1.9 l.8 -3.6 l-2.8 -2.5 l3.7 -.4 z" fill="#D9B44A" stroke="#3D2E1A" strokeWidth="1" />
          {/* hair */}
          <path d="M31 34 C 24 46, 26 58, 32 64 C 34 56, 34 48, 36 42 Z M69 34 C 76 46, 74 58, 68 64 C 66 56, 66 48, 64 42 Z" fill="#A3304A" stroke="#3D2E1A" strokeWidth="2" strokeLinejoin="round" />
          {/* face */}
          <ellipse cx="50" cy="44" rx="17" ry="17" fill="#cfe0b4" stroke="#3D2E1A" strokeWidth="2.5" />
          {/* hat */}
          <path d="M31 30 C 40 24, 46 14, 50 2 C 54 8, 60 6, 64 2 C 60 10, 58 20, 69 30 Z" fill="#5B6236" stroke="#3D2E1A" strokeWidth="2.5" strokeLinejoin="round" />
          <ellipse cx="50" cy="31" rx="29" ry="6" fill="#5B6236" stroke="#3D2E1A" strokeWidth="2.5" />
          <path d="M34 27 q16 5 32 0 l1 4 q-17 5 -34 0 z" fill="#A3304A" stroke="#3D2E1A" strokeWidth="1.5" />
          <rect x="46" y="26.5" width="8" height="6.5" rx="1" fill="none" stroke="#D9B44A" strokeWidth="2" />
          <Face cx={50} cy={45} mood={mood} scale={0.85} cheek="#e89aa5" />
          {/* pointy nose */}
          <path d="M50 44 l3.5 5 l-4 .6" fill="#bcd29e" stroke="#3D2E1A" strokeWidth="1.4" strokeLinejoin="round" />
          {/* cauldron */}
          <g transform="translate(82 84)">
            {(furious || mood === 'celebrate' || mood === 'annoyed') && (
              <g fill="#a6d38a" stroke="#3D2E1A" strokeWidth="1">
                <circle cx="-3" cy={furious ? -16 : -11} r={furious ? 3.5 : 2.5} />
                <circle cx="4" cy={furious ? -22 : -15} r={furious ? 2.8 : 2} />
                {furious && <circle cx="-1" cy="-28" r="2" />}
              </g>
            )}
            <ellipse cx="0" cy="-6" rx="11" ry="3" fill="#a6d38a" stroke="#3D2E1A" strokeWidth="1.5" />
            <path d="M-11 -6 C -13 6, 13 6, 11 -6 Z" fill="#3D2E1A" />
            <path d="M-8 4 l-2 4 M8 4 l2 4" stroke="#3D2E1A" strokeWidth="2" strokeLinecap="round" />
          </g>
          {mood === 'celebrate' && <Sparkles cx={50} cy={44} />}
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
