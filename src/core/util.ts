/** runtime.getURL without WXT's strict PublicPath typing (dynamic asset paths). */
export function assetUrl(path: string): string {
  return (chrome.runtime.getURL as (p: string) => string)(path);
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** True if host equals or is a subdomain of any entry in list. */
export function matchesSiteList(url: string, list: string[]): boolean {
  const host = hostnameOf(url);
  if (!host) return false;
  return list.some((entry) => {
    const e = entry.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    return e && (host === e || host.endsWith('.' + e));
  });
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function fmtClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[“”"'’‘.,!?;:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function isRestrictedUrl(url: string): boolean {
  return (
    !url ||
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('devtools://') ||
    url.startsWith('view-source:')
  );
}
