import type { projectFlowGraph } from '../src/evolution-streams/domain/flow-graph.ts';
import type { ContractOf } from './contract-types.ts';

/** C-3: the graph keeps both branch sources and merge targets. */
export default {
  post: (graph, input) => {
    const ids = new Set(input.variants.filter((v) => input.tides.some((t) => t.id === v.tideId)).map((v) => v.id));
    for (const v of input.variants) {
      if (!ids.has(v.id) || !v.branchedFrom || !ids.has(v.branchedFrom.variantId)) continue;
      if (!graph.edges.some((e) => e.kind === 'branched' && e.to === v.id)) return 'branch edge missing';
    }
    for (const m of input.merges) {
      if (ids.has(m.variantId) && !graph.edges.some((e) => e.kind === 'merged' && e.from === m.variantId)) return 'merge edge missing';
    }
    return true;
  },
} satisfies ContractOf<typeof projectFlowGraph>;
