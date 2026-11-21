import type { planProposal } from '../src/evolution-streams/domain/proposal-rules.ts';
import type { ContractOf } from './contract-types.ts';

export default {
  post: (result, input) => {
    const existing = input.variants.find((variant) => variant.proposal?.id === input.draft.proposalId);
    if (existing) return (result.ok && result.value.kind === 'existing' && result.value.variant.id === existing.id)
      || 'retry did not return the original variant';
    if (input.activeCount >= input.limit) return (!result.ok && result.error.code === 'variant_capacity_reached')
      || 'a new proposal was planned at capacity';
    if (!result.ok) return true;
    return (result.value.kind === 'created' && result.value.variant.proposal?.id === input.draft.proposalId
      && result.value.variant.tideId === result.value.tide.id) || 'proposal and tide linkage lost';
  },
} satisfies ContractOf<typeof planProposal>;
