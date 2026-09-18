import type { FlowGraph, GraphEdge, GraphNode } from './flow-graph.ts';

export interface PlacedNode {
  readonly node: GraphNode;
  readonly x: number;
  readonly y: number;
}

export interface PlacedEdge {
  readonly edge: GraphEdge;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface GraphLayout {
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly PlacedNode[];
  readonly edges: readonly PlacedEdge[];
}

export const LAYOUT = {
  columnWidth: 220,
  rowHeight: 90,
  margin: 40,
  nodeWidth: 180,
  nodeHeight: 52,
} as const;

/**
 * Columns are tides (in the given order), rows are variants in creation order.
 * The official-rules node sits on top; merge edges point up to it.
 */
export function layoutFlowGraph(graph: FlowGraph): GraphLayout {
  const tides = graph.nodes.filter((n) => n.kind === 'tide');
  const columns = Math.max(tides.length, 1);
  const width = LAYOUT.margin * 2 + columns * LAYOUT.columnWidth;
  const placed = new Map<string, PlacedNode>();

  const official = graph.nodes.find((n) => n.kind === 'official');
  if (official) placed.set(official.id, { node: official, x: width / 2, y: LAYOUT.margin + LAYOUT.nodeHeight / 2 });

  let maxRow = 1;
  tides.forEach((tide, column) => {
    const x = LAYOUT.margin + column * LAYOUT.columnWidth + LAYOUT.columnWidth / 2;
    placed.set(tide.id, { node: tide, x, y: LAYOUT.margin + LAYOUT.rowHeight + LAYOUT.nodeHeight / 2 });
    const variants = graph.nodes.filter((n) => n.kind === 'variant' && n.tideId === tide.id);
    variants.forEach((variant, row) => {
      placed.set(variant.id, {
        node: variant,
        x,
        y: LAYOUT.margin + (row + 2) * LAYOUT.rowHeight + LAYOUT.nodeHeight / 2,
      });
      maxRow = Math.max(maxRow, row + 2);
    });
  });

  const edges: PlacedEdge[] = [];
  for (const edge of graph.edges) {
    const from = placed.get(edge.from);
    const to = placed.get(edge.to);
    if (!from || !to) continue;
    edges.push({ edge, x1: from.x, y1: from.y, x2: to.x, y2: to.y });
  }
  return {
    width,
    height: LAYOUT.margin * 2 + (maxRow + 1) * LAYOUT.rowHeight,
    nodes: [...placed.values()],
    edges,
  };
}
