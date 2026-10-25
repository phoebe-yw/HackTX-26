import { providerChain, rememberProvider, type AiModule } from './config';
import { NotConfiguredError, type AiResult, type TextProvider } from './types';

/**
 * Try each provider in the module's chain. `run` performs the call with a
 * provider; `offline` produces curated content when every provider fails.
 * Logs which provider answered.
 */
export async function runChain<T>(
  module: AiModule,
  fnName: string,
  run: (p: TextProvider) => Promise<T>,
  offline: () => T,
): Promise<AiResult<T>> {
  const chain = await providerChain(module);
  const t0 = Date.now();
  for (const p of chain) {
    if (p.id === 'offline') break;
    if (!p.isConfigured()) {
      console.debug(`[ai:${fnName}] ${p.id} skipped (not configured)`);
      continue;
    }
    try {
      const data = await run(p);
      const ms = Date.now() - t0;
      console.info(`[ai:${fnName}] answered by ${p.id} in ${ms}ms`);
      void rememberProvider(fnName, p.id);
      return { data, provider: p.id, ms };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (err instanceof NotConfiguredError) console.debug(`[ai:${fnName}] ${p.id}: ${msg}`);
      else console.warn(`[ai:${fnName}] ${p.id} failed → next. ${msg}`);
    }
  }
  const data = offline();
  console.info(`[ai:${fnName}] answered by offline (curated)`);
  void rememberProvider(fnName, 'offline');
  return { data, provider: 'offline', ms: Date.now() - t0 };
}
