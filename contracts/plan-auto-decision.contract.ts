import type { planAutoDecision } from '../src/adoption-decisions/domain/auto-decision.ts';
import type { ContractOf } from './contract-types.ts';

export default {
  post: (result, variant, evidence, assessment, fingerprint) => {
    if (!result.ok) return assessment.verdict === 'adopt' && evidence.status.target !== 'playable';
    const decision = result.value;
    const trace = decision.automation;
    return (decision.variantId === variant.id && decision.target.commit === evidence.status.targetCommit
      && decision.origin === 'system' && !!decision.decidedBy
      && decision.reason === assessment.rationale && trace?.fingerprint === fingerprint
      && trace?.ratingIds.join() === evidence.ratingIds.join()
      && trace?.playtestIds.join() === evidence.playtestIds.join()) || 'automatic decision lost its provenance';
  },
} satisfies ContractOf<typeof planAutoDecision>;
