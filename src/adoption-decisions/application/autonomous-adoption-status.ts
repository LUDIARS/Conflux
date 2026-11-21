import { countActiveVariants } from '../../evolution-streams/application/proposal-intake.ts';
import type { Variant } from '../../evolution-streams/domain/model.ts';
import { requireWorkspace, type WorkspaceDeps } from '../../project-workspaces/application/workspace-use-cases.ts';
import { DEFAULT_AUTONOMOUS_ADOPTION, type AutonomousAdoptionPolicy } from '../../project-workspaces/domain/autonomous-adoption-policy.ts';
import type { RecordStore } from '../../shared/record-store.ts';
import { ok, type Result } from '../../shared/result.ts';
import { serialByKey } from '../../shared/serial-by-key.ts';
import type { AdoptionDecision } from '../domain/model.ts';

interface AutonomousAdoptionStatus {
  readonly policy: AutonomousAdoptionPolicy;
  readonly activeCount: number;
  readonly proposals: readonly { readonly proposalId: string; readonly tideId: string; readonly variantId: string }[];
  readonly decisions: readonly AdoptionDecision[];
}

export async function readAutonomousAdoptionStatus(
  deps: WorkspaceDeps & { readonly variants: RecordStore<Variant>; readonly decisions: RecordStore<AdoptionDecision> },
  projectCode: string,
): Promise<Result<AutonomousAdoptionStatus>> {
  return serialByKey(deps.workspaces, projectCode, async () => {
    const workspace = await requireWorkspace(deps.workspaces, projectCode);
    if (!workspace.ok) return workspace;
    const [variants, decisions] = await Promise.all([
      deps.variants.listByProject(projectCode), deps.decisions.listByProject(projectCode),
    ]);
    return ok({
      policy: workspace.value.autonomousAdoption ?? DEFAULT_AUTONOMOUS_ADOPTION,
      activeCount: countActiveVariants(variants, decisions),
      proposals: variants.flatMap((variant) => variant.proposal
        ? [{ proposalId: variant.proposal.id, tideId: variant.tideId, variantId: variant.id }]
        : []),
      decisions,
    });
  });
}
