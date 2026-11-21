import { createHash } from 'node:crypto';
import { effectiveDecisions } from '../../adoption-decisions/domain/decision-history.ts';
import type { AdoptionDecision } from '../../adoption-decisions/domain/model.ts';
import { requireWorkspace } from '../../project-workspaces/application/workspace-use-cases.ts';
import { DEFAULT_AUTONOMOUS_ADOPTION } from '../../project-workspaces/domain/autonomous-adoption-policy.ts';
import type { RecordStore } from '../../shared/record-store.ts';
import { type Result } from '../../shared/result.ts';
import { serialByKey } from '../../shared/serial-by-key.ts';
import { planProposal, type ProposalDraft, type ProposalPlan } from '../domain/proposal-rules.ts';
import type { FlowDeps } from './flow-use-cases.ts';

type ProposalDeps = FlowDeps & { readonly decisions: RecordStore<AdoptionDecision> };

export async function receiveProposal(deps: ProposalDeps, draft: ProposalDraft): Promise<Result<ProposalPlan>> {
  return serialByKey(deps.workspaces, draft.projectCode, async () => {
    const workspace = await requireWorkspace(deps.workspaces, draft.projectCode);
    if (!workspace.ok) return workspace;
    const [tides, variants, decisions] = await Promise.all([
      deps.tides.listByProject(draft.projectCode),
      deps.variants.listByProject(draft.projectCode),
      deps.decisions.listByProject(draft.projectCode),
    ]);
    const at = deps.clock.now();
    const variantSlug = `p-${createHash('sha256').update(draft.proposalId).digest('hex').slice(0, 38)}`;
    const planned = planProposal({
      draft, tides, variants, variantSlug,
      activeCount: countActiveVariants(variants, decisions),
      limit: (workspace.value.autonomousAdoption ?? DEFAULT_AUTONOMOUS_ADOPTION).maxActiveVariants,
      tideStamp: { id: deps.ids.next('tide'), at },
      variantStamp: { id: deps.ids.next('variant'), at },
    });
    if (!planned.ok || planned.value.kind === 'existing') return planned;
    if (planned.value.createTide) await deps.tides.put(planned.value.tide);
    await deps.variants.put(planned.value.variant);
    return planned;
  });
}

export function countActiveVariants(
  variants: readonly { readonly id: string }[],
  decisions: readonly AdoptionDecision[],
): number {
  const effective = effectiveDecisions(decisions);
  return variants.filter(({ id }) => {
    const decision = effective.get(id);
    return !decision || decision.verdict === 'held';
  }).length;
}
