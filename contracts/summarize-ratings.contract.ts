import type { summarizeRatings } from '../src/play-feedback/domain/rating-rules.ts';
import type { ContractOf } from './contract-types.ts';

/** C-6: only the current target build is labelled current. */
export default {
  post: (summaries, _ratings, currentBuildId) => summaries.every((s) => !s.isCurrent || s.buildId === currentBuildId) || 'past build labelled current',
} satisfies ContractOf<typeof summarizeRatings>;
