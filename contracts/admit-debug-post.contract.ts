import type { admitDebugPost } from '../src/play-feedback/domain/debug-intake.ts';
import type { ContractOf } from './contract-types.ts';

/** C-5: debug posts are refused outside Cf Flow and bound to the claimed build. */
export default {
  post: (result, input) => {
    if (!input.intakeOpen) return !result.ok || 'post admitted while intake closed';
    if (!result.ok) return true;
    return (result.value.playedBuild.buildId === input.claim.buildId && result.value.playedBuild.commit === input.claim.commit) || 'build binding drifted';
  },
} satisfies ContractOf<typeof admitDebugPost>;
