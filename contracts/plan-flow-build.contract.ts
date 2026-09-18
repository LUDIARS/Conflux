import type { planFlowBuild } from '../src/playable-results/domain/build-requests.ts';
import type { ContractOf } from './contract-types.ts';

/** C-12: a repeated trigger for the same build identity returns the existing record. */
export default {
  post: (result, existing) => {
    if (!result.ok || result.value.action !== 'send') return true;
    const key = result.value.build.dedupeKey;
    return !existing.some((b) => b.dedupeKey === key) || 'duplicate build sent';
  },
} satisfies ContractOf<typeof planFlowBuild>;
