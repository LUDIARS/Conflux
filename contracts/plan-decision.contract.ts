import type { planDecision } from '../src/adoption-decisions/domain/decision-rules.ts';
import type { ContractOf } from './contract-types.ts';

/** C-7: adoption needs a playable artifact of the chosen commit; every decision keeps a reason. */
export default {
  post: (result, ctx, draft) => {
    if (!result.ok) return true;
    if (result.value.reason.length === 0) return 'decision without reason';
    if (draft.verdict !== 'adopted') return true;
    const e = ctx.evidence;
    return (!!e && e.commit === draft.commit && e.artifactIds.length > 0) || 'adopted without playable artifact';
  },
} satisfies ContractOf<typeof planDecision>;
