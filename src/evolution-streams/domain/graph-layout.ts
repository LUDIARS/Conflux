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

/**
 * Which way the flow advances on screen. `rightward` (wide screens): progress runs left → right
 * and tides branch vertically. `upward` (narrow screens): progress runs bottom → top and tides
 * branch horizontally.
 */
export type FlowOrientation = 'rightward' | 'upward';

export const LAYOUT = {
  /** Spacing between steps along the flow when it runs horizontally (node width + gap). */
  stepWidth: 220,
  /** Spacing between steps along the flow when it runs vertically (node height + gap). */
  stepHeight: 90,
  /** Spacing between tide lanes when they stack vertically. */
  laneHeight: 90,
  /** Spacing between tide lanes when they sit side by side. */
  laneWidth: 220,
  margin: 40,
  nodeWidth: 180,
  nodeHeight: 52,
} as const;

/** Position in flow terms: `lane` is the tide, `step` is how far along the flow the node is. */
interface FlowSlot {
  readonly node: GraphNode;
  /** Tide index; the official rules span every lane, so they sit on the lanes' midpoint. */
  readonly lane: number;
  readonly step: number;
}

/** Step 0 is the official rules, step 1 each tide, then its variants in creation order. */
function slotFlowGraph(graph: FlowGraph): { slots: FlowSlot[]; lanes: number; steps: number } {
  const tides = graph.nodes.filter((n) => n.kind === 'tide');
  const lanes = Math.max(tides.length, 1);
  const slots: FlowSlot[] = [];
  const official = graph.nodes.find((n) => n.kind === 'official');
  if (official) slots.push({ node: official, lane: (lanes - 1) / 2, step: 0 });
  let steps = 2;
  tides.forEach((tide, lane) => {
    slots.push({ node: tide, lane, step: 1 });
    const variants = graph.nodes.filter((n) => n.kind === 'variant' && n.tideId === tide.id);
    variants.forEach((variant, index) => slots.push({ node: variant, lane, step: index + 2 }));
    steps = Math.max(steps, variants.length + 2);
  });
  return { slots, lanes, steps };
}

/** Maps flow slots onto screen coordinates for the chosen orientation (node centres). */
function placeSlots(lanes: number, steps: number, orientation: FlowOrientation) {
  const { margin, nodeWidth, nodeHeight } = LAYOUT;
  if (orientation === 'rightward') {
    return {
      width: margin * 2 + (steps - 1) * LAYOUT.stepWidth + nodeWidth,
      height: margin * 2 + (lanes - 1) * LAYOUT.laneHeight + nodeHeight,
      place: (s: FlowSlot) => ({ x: margin + nodeWidth / 2 + s.step * LAYOUT.stepWidth, y: margin + nodeHeight / 2 + s.lane * LAYOUT.laneHeight }),
    };
  }
  const height = margin * 2 + (steps - 1) * LAYOUT.stepHeight + nodeHeight;
  return {
    width: margin * 2 + (lanes - 1) * LAYOUT.laneWidth + nodeWidth,
    height,
    // Upward: step 0 sits at the bottom edge and later steps climb toward the top.
    place: (s: FlowSlot) => ({ x: margin + nodeWidth / 2 + s.lane * LAYOUT.laneWidth, y: height - margin - nodeHeight / 2 - s.step * LAYOUT.stepHeight }),
  };
}

export function layoutFlowGraph(graph: FlowGraph, orientation: FlowOrientation): GraphLayout {
  const { slots, lanes, steps } = slotFlowGraph(graph);
  const { width, height, place } = placeSlots(lanes, steps, orientation);
  const placed = new Map<string, PlacedNode>(slots.map((s) => [s.node.id, { node: s.node, ...place(s) }]));

  const edges: PlacedEdge[] = [];
  for (const edge of graph.edges) {
    const from = placed.get(edge.from);
    const to = placed.get(edge.to);
    if (!from || !to) continue;
    edges.push({ edge, x1: from.x, y1: from.y, x2: to.x, y2: to.y });
  }
  return { width, height, nodes: [...placed.values()], edges };
}
