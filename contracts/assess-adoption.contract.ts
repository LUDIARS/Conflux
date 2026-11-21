import type { assessAdoption } from '../src/adoption-decisions/domain/auto-adoption-rules.ts';
import type { ContractOf } from './contract-types.ts';

export default {
  post: (result, policy, evidence) => {
    if (!policy.enabled || evidence.target !== 'playable') return result.verdict === 'hold' || 'unsafe build or disabled policy';
    if (result.verdict !== 'adopt') return true;
    return (evidence.measuredTrials >= policy.minPlaytests && evidence.ratingCount >= policy.minRatings
      && evidence.ratingScore !== undefined && evidence.ratingScore >= policy.minRatingScore
      && evidence.criticalBugs <= policy.maxCriticalBugs && evidence.failureRate <= policy.maxFailureRate)
      || 'adopted without the required evidence';
  },
} satisfies ContractOf<typeof assessAdoption>;
