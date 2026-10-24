import type { Mood } from "./types";

export function Egg({ mood, label }: { mood: Mood; label?: string }) {
  const pupilX = mood === "sideeye" ? 7 : 0;
  const pupilY = mood === "mad" ? 1 : 0;
  return (
    <svg className={`egg egg-${mood}`} viewBox="0 0 160 190" role="img" aria-label={label ?? `Eggward is ${mood}`}>
      <ellipse cx="80" cy="112" rx="58" ry="70" fill="#fffaf2" stroke="#24170f" strokeWidth="5" />
      <path d="M78 44c10 8 8 18 18 24" fill="none" stroke="#24170f" strokeWidth="4" strokeLinecap="round" />
      {mood === "mad" && (
        <>
          <path d="M42 78l24 10" stroke="#24170f" strokeWidth="5" strokeLinecap="round" />
          <path d="M118 78l-24 10" stroke="#24170f" strokeWidth="5" strokeLinecap="round" />
        </>
      )}
      <circle cx="58" cy="104" r="14" fill="#fff" stroke="#24170f" strokeWidth="4" />
      <circle cx="102" cy="104" r="14" fill="#fff" stroke="#24170f" strokeWidth="4" />
      <circle cx={58 + pupilX} cy={104 + pupilY} r={mood === "mad" ? 4 : 6} fill="#24170f" />
      <circle cx={102 + pupilX} cy={104 + pupilY} r={mood === "mad" ? 4 : 6} fill="#24170f" />
      <circle cx="48" cy="128" r="8" fill="#ffb4a8" opacity={mood === "fine" ? 0.9 : 0.45} />
      <circle cx="112" cy="128" r="8" fill="#ffb4a8" opacity={mood === "fine" ? 0.9 : 0.45} />
      {mood === "mad" ? (
        <path d="M62 146c8 8 28 8 36 0" fill="none" stroke="#24170f" strokeWidth="4" strokeLinecap="round" />
      ) : mood === "sideeye" ? (
        <path d="M66 148h28" stroke="#24170f" strokeWidth="4" strokeLinecap="round" />
      ) : (
        <path d="M66 144c8 10 22 10 30 0" fill="none" stroke="#24170f" strokeWidth="4" strokeLinecap="round" />
      )}
    </svg>
  );
}
