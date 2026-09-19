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

  describe('orientation', () => {
    // v3 comes after v1 in the same tide, so it is one step further along the flow.
    const later: Variant = { ...base, id: 'v3', tideId: 't1', slug: 'finisher', title: '決め手' };
    const flow = projectFlowGraph({ tides, variants: [...variants, later], merges: [{ variantId: 'v2', integration: 'awaiting' }] });
    const placed = (layout: ReturnType<typeof layoutFlowGraph>, id: string) => {
      const p = layout.nodes.find((n) => n.node.id === id);
      assert.ok(p, `node ${id} is placed`);
      return p;
    };

    it('rightward: the flow advances to the right and tides branch vertically', () => {
      const layout = layoutFlowGraph(flow, 'rightward');
      assert.ok(placed(layout, 't1').x > placed(layout, OFFICIAL_NODE_ID).x);
      assert.ok(placed(layout, 'v3').x > placed(layout, 'v1').x);
      assert.equal(placed(layout, 'v3').y, placed(layout, 'v1').y);
      assert.notEqual(placed(layout, 't1').y, placed(layout, 't2').y);
      assert.equal(placed(layout, 't1').x, placed(layout, 't2').x);
      assert.equal(layout.edges.length, flow.edges.length);
    });

    it('upward: the flow advances toward the top and tides branch horizontally', () => {
      const layout = layoutFlowGraph(flow, 'upward');
      assert.ok(placed(layout, 't1').y < placed(layout, OFFICIAL_NODE_ID).y);
      assert.ok(placed(layout, 'v3').y < placed(layout, 'v1').y);
      assert.equal(placed(layout, 'v3').x, placed(layout, 'v1').x);
      assert.notEqual(placed(layout, 't1').x, placed(layout, 't2').x);
      assert.equal(placed(layout, 't1').y, placed(layout, 't2').y);
      assert.equal(layout.edges.length, flow.edges.length);
    });

    it('keeps every node inside the drawing in both orientations', () => {
      for (const orientation of ['rightward', 'upward'] as const) {
        const layout = layoutFlowGraph(flow, orientation);
        for (const { x, y } of layout.nodes) {
          assert.ok(x > 0 && x < layout.width && y > 0 && y < layout.height, `${orientation} ${x},${y}`);
        }
      }
    });
  });
});
