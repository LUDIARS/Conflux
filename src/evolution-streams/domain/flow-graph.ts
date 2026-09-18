import { mainlineBranchName, type BranchNamingPolicy } from './branch-naming.ts';
import type { Tide, Variant } from './model.ts';

/**
 * Projection of flow state into a graph (CF-GRAPH-001). Merges point at the
 * official-rules node, so the structure is a DAG rather than a tree.
 */
export type GraphNode =
  | { readonly kind: 'official'; readonly id: string; readonly label: string }
  | { readonly kind: 'tide'; readonly id: string; readonly label: string; readonly concept: string }
  | {
      readonly kind: 'variant';
      readonly id: string;
      readonly tideId: string;
      readonly label: string;
      readonly concept: string;
      /** Undefined while the project's branch naming is undecided. */
      readonly mainlineBranch?: string;
    };

export type IntegrationMark = 'awaiting' | 'integrated' | 'integration_failed';

export type GraphEdge =
  | { readonly kind: 'contains'; readonly from: string; readonly to: string }
  | { readonly kind: 'branched'; readonly from: string; readonly to: string; readonly commit?: string }
  | { readonly kind: 'merged'; readonly from: string; readonly to: string; readonly integration: IntegrationMark };

export interface FlowGraph {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

/** Adoption facts needed by the projection; kept minimal so this domain does not own decisions. */
export interface MergeMark {
  readonly variantId: string;
  readonly integration: IntegrationMark;
}

export const OFFICIAL_NODE_ID = 'official';

export function projectFlowGraph(input: {
  readonly tides: readonly Tide[];
  readonly variants: readonly Variant[];
  readonly merges: readonly MergeMark[];
  readonly naming?: BranchNamingPolicy;
}): FlowGraph {
  const tideById = new Map(input.tides.map((t) => [t.id, t] as const));
  const variantIds = new Set(input.variants.map((v) => v.id));
  const nodes: GraphNode[] = [{ kind: 'official', id: OFFICIAL_NODE_ID, label: '正式ルール' }];
  const edges: GraphEdge[] = [];

  for (const tide of input.tides) {
    nodes.push({ kind: 'tide', id: tide.id, label: tide.title, concept: tide.concept });
  }
  for (const variant of input.variants) {
    const tide = tideById.get(variant.tideId);
    if (!tide) continue;
    nodes.push({
      kind: 'variant',
      id: variant.id,
      tideId: tide.id,
      label: variant.title,
      concept: variant.concept,
      ...(input.naming ? { mainlineBranch: mainlineBranchName(input.naming, tide.slug, variant.slug) } : {}),
    });
    edges.push({ kind: 'contains', from: tide.id, to: variant.id });
    if (variant.branchedFrom && variantIds.has(variant.branchedFrom.variantId)) {
      edges.push({
        kind: 'branched',
        from: variant.branchedFrom.variantId,
        to: variant.id,
        ...(variant.branchedFrom.commit ? { commit: variant.branchedFrom.commit } : {}),
      });
    }
  }
  for (const merge of input.merges) {
    if (!variantIds.has(merge.variantId)) continue;
    edges.push({ kind: 'merged', from: merge.variantId, to: OFFICIAL_NODE_ID, integration: merge.integration });
  }
  return { nodes, edges };
}
