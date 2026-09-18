import { describeIntegration, officialLineage } from '../../adoption-decisions/domain/decision-rules.ts';
import type { AdoptionDecision } from '../../adoption-decisions/domain/model.ts';
import type { SelectionRecord } from '../../flow-isolation/domain/selection-record.ts';
import type { ImplementationRequest } from '../../implementation-requests/domain/model.ts';
import { buildThreads, type CommentThread } from '../../play-feedback/domain/comment-rules.ts';
import type { Comment, Rating } from '../../play-feedback/domain/model.ts';
import { summarizeRatings, type BuildRatingSummary } from '../../play-feedback/domain/rating-rules.ts';
import { traceComment, type CommentTrace } from '../../play-feedback/domain/trace.ts';
import type { Artifact, Build, Deployment } from '../../playable-results/domain/model.ts';
import { variantResultStatus, type VariantResultStatus } from '../../playable-results/domain/result-status.ts';
import { requireWorkspace } from '../../project-workspaces/application/workspace-use-cases.ts';
import type { ProjectWorkspace } from '../../project-workspaces/domain/model.ts';
import type { RecordStore } from '../../shared/record-store.ts';
import { ok, type Result } from '../../shared/result.ts';
import { projectFlowGraph, type FlowGraph, type IntegrationMark } from '../domain/flow-graph.ts';
import { targetCommitOf } from '../domain/flow-rules.ts';
import type { Revision, Tide, Variant } from '../domain/model.ts';

export interface OverviewDeps {
  readonly workspaces: RecordStore<ProjectWorkspace>;
  readonly tides: RecordStore<Tide>;
  readonly variants: RecordStore<Variant>;
  readonly revisions: RecordStore<Revision>;
  readonly comments: RecordStore<Comment>;
  readonly ratings: RecordStore<Rating>;
  readonly decisions: RecordStore<AdoptionDecision>;
  readonly requests: RecordStore<ImplementationRequest>;
  readonly selections: RecordStore<SelectionRecord>;
  readonly builds: RecordStore<Build>;
  readonly artifacts: RecordStore<Artifact>;
  readonly deployments: RecordStore<Deployment>;
}

export interface VariantDetail {
  readonly variant: Variant;
  readonly tide: Tide;
  readonly revisions: readonly Revision[];
  readonly threads: readonly CommentThread[];
  readonly traces: readonly CommentTrace[];
  readonly ratings: readonly BuildRatingSummary[];
  readonly result: VariantResultStatus;
  readonly builds: readonly Build[];
  readonly deployments: readonly Deployment[];
  readonly requests: readonly ImplementationRequest[];
  readonly selections: readonly SelectionRecord[];
  readonly decisions: readonly AdoptionDecision[];
}

export interface ProjectOverview {
  readonly workspace: ProjectWorkspace;
  readonly tides: readonly Tide[];
  readonly variants: readonly Variant[];
  readonly graph: FlowGraph;
  readonly official: readonly { readonly decision: AdoptionDecision; readonly integrationLabel: string }[];
  /** Detail for the selected graph node; always derived from the same variant id as the selection. */
  readonly selected?: VariantDetail;
}

function mergeMark(d: AdoptionDecision): IntegrationMark {
  return d.integration.state === 'integrated' ? 'integrated' : d.integration.state === 'integration_failed' ? 'integration_failed' : 'awaiting';
}

/** Project-centred graph view plus the detail of the selected variant (CF-GRAPH-001). */
export async function loadProjectOverview(
  deps: OverviewDeps,
  projectCode: string,
  selectedVariantId?: string,
): Promise<Result<ProjectOverview>> {
  const ws = await requireWorkspace(deps.workspaces, projectCode);
  if (!ws.ok) return ws;
  const [tides, variants, revisions, comments, ratings, decisions, requests, selections, builds, artifacts, deployments] = await Promise.all([
    deps.tides.listByProject(projectCode),
    deps.variants.listByProject(projectCode),
    deps.revisions.listByProject(projectCode),
    deps.comments.listByProject(projectCode),
    deps.ratings.listByProject(projectCode),
    deps.decisions.listByProject(projectCode),
    deps.requests.listByProject(projectCode),
    deps.selections.listByProject(projectCode),
    deps.builds.listByProject(projectCode),
    deps.artifacts.listByProject(projectCode),
    deps.deployments.listByProject(projectCode),
  ]);
  const adopted = officialLineage(decisions);
  const graph = projectFlowGraph({
    tides,
    variants,
    merges: adopted.map((d) => ({ variantId: d.variantId, integration: mergeMark(d) })),
    ...(ws.value.branchNaming ? { naming: ws.value.branchNaming } : {}),
  });

  const variant = selectedVariantId ? variants.find((v) => v.id === selectedVariantId) : undefined;
  const tide = variant ? tides.find((t) => t.id === variant.tideId) : undefined;
  let selected: VariantDetail | undefined;
  if (variant && tide) {
    const variantComments = comments.filter((c) => c.variantId === variant.id);
    const targetCommit = targetCommitOf(revisions, variant.id);
    const result = variantResultStatus({ variantId: variant.id, ...(targetCommit ? { targetCommit } : {}), builds, artifacts });
    const facts = {
      requests,
      decisions,
      summaries: comments.flatMap((c) => (c.author.kind === 'ai-summary' ? [{ id: c.id, sourceCommentIds: c.author.sourceCommentIds }] : [])),
    };
    selected = {
      variant,
      tide,
      revisions: revisions.filter((r) => r.variantId === variant.id),
      threads: buildThreads(variantComments),
      traces: variantComments.filter((c) => c.author.kind === 'human').map((c) => traceComment(c.id, facts)),
      ratings: summarizeRatings(
        ratings.filter((r) => r.variantId === variant.id),
        result.targetBuild?.id,
      ),
      result,
      builds: builds.filter((b) => b.variantId === variant.id),
      deployments: deployments.filter((d) => d.variantId === variant.id),
      requests: requests.filter((r) => r.variantId === variant.id),
      selections: selections.filter((s) => s.variantId === variant.id),
      decisions: decisions.filter((d) => d.variantId === variant.id),
    };
  }
  return ok({
    workspace: ws.value,
    tides,
    variants,
    graph,
    official: adopted.map((decision) => ({ decision, integrationLabel: describeIntegration(decision.integration) })),
    ...(selected ? { selected } : {}),
  });
}
