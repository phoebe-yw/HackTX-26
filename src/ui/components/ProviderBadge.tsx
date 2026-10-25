import { PROVIDER_LABEL } from '@/ai/types';
import type { AiProviderId } from '@/core/types';

export function ProviderBadge({ provider, prefix }: { provider?: string; prefix?: string }) {
  if (!provider) return null;
  const id = (['gemini', 'meta', 'offline'].includes(provider) ? provider : 'offline') as AiProviderId;
  const icon = id === 'meta' ? '✨' : id === 'gemini' ? '👁️' : '📜';
  return (
    <span className={`badge ${id}`} title={`This answer came from ${id}`}>
      {icon} {prefix ? `${prefix} · ` : ''}
      {PROVIDER_LABEL[id]}
    </span>
  );
}
