import type { planVariant } from '../src/evolution-streams/domain/flow-rules.ts';
import type { ContractOf } from './contract-types.ts';

/** C-1: a duplicate variant slug within the same tide is never accepted. */
export default {
  post: (result, _tides, variants, draft) =>
    !variants.some((v) => v.tideId === draft.tideId && v.slug === draft.slug) || !result.ok || 'duplicate variant accepted',
} satisfies ContractOf<typeof planVariant>;
