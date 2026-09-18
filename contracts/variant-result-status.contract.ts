import type { variantResultStatus } from '../src/playable-results/domain/result-status.ts';
import type { ContractOf } from './contract-types.ts';

/** C-11: "playable" and "is target" are only claimed for the target commit. */
export default {
  post: (status, input) => {
    if (status.target === 'playable' && status.targetBuild?.commit !== input.targetCommit) return 'playable claimed for another commit';
    if (status.lastPlayable?.isTarget && status.lastPlayable.build.commit !== input.targetCommit) return 'past build labelled target';
    return true;
  },
} satisfies ContractOf<typeof variantResultStatus>;
