import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OFFICIAL_NODE_ID, projectFlowGraph } from '../../src/evolution-streams/domain/flow-graph.ts';
import { layoutFlowGraph } from '../../src/evolution-streams/domain/graph-layout.ts';
import type { Tide, Variant } from '../../src/evolution-streams/domain/model.ts';

const at = '2026-09-18T00:00:00.000Z';
const tides: Tide[] = [
  { id: 't1', projectCode: 'KD', slug: 'rush', title: '速攻', concept: 'a', createdAt: at },
  { id: 't2', projectCode: 'KD', slug: 'slow', title: '持久', concept: 'b', createdAt: at },
];
const base = { projectCode: 'KD', concept: 'c', rules: [], createdAt: at };
const variants: Variant[] = [
  { ...base, id: 'v1', tideId: 't1', slug: 'combo', title: 'コンボ' },
  { ...base, id: 'v2', tideId: 't2', slug: 'guard', title: 'ガード', branchedFrom: { variantId: 'v1', commit: 'abc1234' } },
];

describe('flow graph projection', () => {
  const graph = projectFlowGraph({
    tides,
    variants,
    merges: [{ variantId: 'v2', integration: 'awaiting' }],
    naming: { evolutionPrefix: 'evolution', workPrefix: 'feature', mainline: 'suffix-main' },
  });

  it('shows branch source and merge target (not a tree)', () => {
    assert.ok(graph.edges.some((e) => e.kind === 'branched' && e.from === 'v1' && e.to === 'v2'));
    assert.ok(graph.edges.some((e) => e.kind === 'merged' && e.from === 'v2' && e.to === OFFICIAL_NODE_ID && e.integration === 'awaiting'));
  });

  it('labels each variant with its mainline branch under the naming policy', () => {
    const v1 = graph.nodes.find((n) => n.id === 'v1');
    assert.equal(v1?.kind === 'variant' ? v1.mainlineBranch : undefined, 'evolution/rush/combo/main');
  });

  it('omits mainline labels while naming is undecided', () => {
    const g = projectFlowGraph({ tides, variants, merges: [] });
    const v1 = g.nodes.find((n) => n.id === 'v1');
    assert.equal(v1?.kind === 'variant' ? v1.mainlineBranch : 'x', undefined);
  });

  it('lays out one column per tide and places every edge endpoint', () => {
    const layout = layoutFlowGraph(graph);
    const x1 = layout.nodes.find((n) => n.node.id === 'v1')?.x;
    const x2 = layout.nodes.find((n) => n.node.id === 'v2')?.x;
    assert.notEqual(x1, x2);
    assert.equal(layout.edges.length, graph.edges.length);
  });
});
