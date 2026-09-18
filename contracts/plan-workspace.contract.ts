import type { planWorkspace } from '../src/project-workspaces/domain/workspace-rules.ts';
import type { ContractOf } from './contract-types.ts';

/** C-9: configuring Cf never flips the Cc-owned Cf Flow observation and never starts as enabled. */
export default {
  post: (result, existing) => {
    if (!result.ok) return true;
    if (!existing) return result.value.flowObservation.state !== 'enabled' || 'new workspace claims enabled';
    return JSON.stringify(result.value.flowObservation) === JSON.stringify(existing.flowObservation) || 'observation changed by settings';
  },
} satisfies ContractOf<typeof planWorkspace>;
