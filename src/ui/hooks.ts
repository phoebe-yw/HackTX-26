import { useEffect, useRef, useState } from 'react';
import * as store from '@/core/storage';
import type { LocalKey, LocalSchema } from '@/core/storage';

/** Live view of a chrome.storage.local key. */
export function useStored<K extends LocalKey>(key: K): [LocalSchema[K] | undefined, (v: LocalSchema[K]) => Promise<void>] {
  const [val, setVal] = useState<LocalSchema[K] | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    store.get(key).then((v) => alive && setVal(v));
    const un = store.watch(key, (v) => alive && setVal(v));
    return () => {
      alive = false;
      un();
    };
  }, [key]);
  return [val, (v) => store.set(key, v)];
}

/** Live view of a chrome.storage.session key (social mirror). */
export function useSessionStored<T>(key: string, fallback: T): T {
  const [val, setVal] = useState<T>(fallback);
  useEffect(() => {
    let alive = true;
    store.getSession<T>(key, fallback).then((v) => alive && setVal(v));
    const un = store.watchSession<T>(key, (v) => alive && setVal(v ?? fallback));
    return () => {
      alive = false;
      un();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return val;
}

/** Re-render every `ms` (for countdowns). */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Returns true for `ms` after `trigger` changes (skips initial). */
export function useFlash(trigger: unknown, ms: number): boolean {
  const [on, setOn] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setOn(true);
    const id = setTimeout(() => setOn(false), ms);
    return () => clearTimeout(id);
  }, [trigger, ms]);
  return on;
}
