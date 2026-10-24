export type Mood = "fine" | "sideeye" | "mad";

export type PetSnapshot = {
  mood: Mood;
  strikes: number;
  locked: boolean;
  challengeText: string | null;
  blockedSince: number | null;
};

export function thresholds() {
  const side = Number(process.env.STRIKE_SIDEEYE_SEC ?? 20);
  const mad = Number(process.env.STRIKE_MAD_SEC ?? 45);
  return {
    sideEye: Number.isFinite(side) && side > 0 ? side : 20,
    mad: Number.isFinite(mad) && mad > 0 ? mad : 45,
  };
}

export function hostBlocked(hostname: string, domains: string[]) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return false;
  return domains.some((raw) => {
    const domain = raw.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  });
}

export function normalizeDomain(input: string) {
  let value = input.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "");
  value = value.split("/")[0] ?? "";
  value = value.replace(/^\*\./, "").replace(/\.$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(value)) return null;
  return value;
}

export function nextPet(pet: PetSnapshot, now: number): PetSnapshot {
  if (pet.locked) return pet;
  if (pet.blockedSince == null) {
    if (pet.mood === "fine" && pet.strikes === 0 && pet.challengeText == null) return pet;
    return { ...pet, mood: "fine", strikes: 0, challengeText: null };
  }
  const elapsed = Math.max(0, Math.floor((now - pet.blockedSince) / 1000));
  const { sideEye, mad } = thresholds();
  if (elapsed >= mad) {
    return {
      ...pet,
      mood: "mad",
      strikes: elapsed,
      locked: true,
      challengeText: "Show me an egg.",
      blockedSince: null,
    };
  }
  if (elapsed >= sideEye) {
    return { ...pet, mood: "sideeye", strikes: elapsed, challengeText: null };
  }
  return { ...pet, mood: "fine", strikes: elapsed, challengeText: null };
}

export function offTask(hostname: string, blocklist: string[], workSites: string[]) {
  if (workSites.length > 0) return !hostBlocked(hostname, workSites);
  return hostBlocked(hostname, blocklist);
}

export function withPresence(pet: PetSnapshot, hostname: string, domains: string[], now: number, workSites: string[] = []) {
  if (pet.locked) return pet;
  if (offTask(hostname, domains, workSites)) {
    return nextPet({ ...pet, blockedSince: pet.blockedSince ?? now }, now);
  }
  return nextPet({ ...pet, blockedSince: null, mood: "fine", strikes: 0, challengeText: null }, now);
}

export function moodChanged(before: PetSnapshot, after: PetSnapshot) {
  return (
    before.mood !== after.mood ||
    before.locked !== after.locked ||
    before.challengeText !== after.challengeText
  );
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export const DEFAULT_BLOCKLIST = [
  "youtube.com",
  "instagram.com",
  "reddit.com",
  "netflix.com",
  "x.com",
  "twitter.com",
];
