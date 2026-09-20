import type { FlowGraph, GraphNode } from '../../../evolution-streams/domain/flow-graph.ts';
import { LAYOUT, layoutFlowGraph, type FlowOrientation } from '../../../evolution-streams/domain/graph-layout.ts';
import { esc } from './escape.ts';
import type { GraphZoom } from './graph-zoom.ts';
import { truncateLabel } from './svg-label.ts';

const EDGE_STYLE: Readonly<Record<string, string>> = {
  contains: 'stroke="currentColor" stroke-opacity="0.35"',
  branched: 'stroke="#f59e0b" stroke-dasharray="4 3"',
  merged: 'stroke="#8b5cf6" stroke-width="2"',
};

const NODE_FILL: Readonly<Record<string, string>> = { official: '#8b5cf6', tide: '#3b82f6', variant: '#22c55e' };

/** Node text budget in em at the 12px graph font (node width 180px minus padding). */
const LABEL_EM = 13;

function subLabel(node: GraphNode): string {
  if (node.kind === 'variant') return node.mainlineBranch ?? '本流命名 未設定';
  return node.kind === 'tide' ? '潮流' : '';
}

/**
 * Auto keeps the drawn size in the markup and lets the stylesheet shrink only the orientation
 * the screen is showing, so one zoom value can suit both widths without a script.
 */
function sizeAttributes(width: number, height: number, zoom: GraphZoom): string {
  if (zoom.kind === 'fit') return 'width="100%" preserveAspectRatio="xMidYMin meet"';
  const scale = zoom.kind === 'auto' ? 1 : zoom.value;
  return `width="${Math.round(width * scale)}" height="${Math.round(height * scale)}" preserveAspectRatio="xMidYMin meet"`;
}

/**
 * Renders the flow graph as inline SVG. Variant nodes link to `variantHref(id)`, so the
 * selected node and the detail pane share one id. Long names are shortened on the node
 * only; the link name and `<title>` keep the full text.
 */
export function renderGraphSvg(
  graph: FlowGraph,
  selectedVariantId: string | undefined,
  zoom: GraphZoom,
  variantHref: (variantId: string) => string,
  orientation: FlowOrientation,
): string {
  const layout = layoutFlowGraph(graph, orientation);
  const w = LAYOUT.nodeWidth;
  const h = LAYOUT.nodeHeight;
  const tideLabel = new Map(graph.nodes.filter((n) => n.kind === 'tide').map((n) => [n.id, n.label] as const));
  const edges = layout.edges
    .map((e) => {
      const dash = e.edge.kind === 'merged' && e.edge.integration !== 'integrated' ? ' stroke-dasharray="6 4"' : '';
      return `<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" ${EDGE_STYLE[e.edge.kind] ?? ''}${dash}><title>${esc(e.edge.kind === 'merged' ? `合流 (${e.edge.integration})` : e.edge.kind)}</title></line>`;
    })
    .join('');
  const nodes = layout.nodes
    .map(({ node, x, y }) => {
      const selected = node.kind === 'variant' && node.id === selectedVariantId;
      const rect = `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="8" fill="${NODE_FILL[node.kind]}" fill-opacity="${selected ? 0.45 : 0.18}" stroke="${NODE_FILL[node.kind]}" stroke-width="${selected ? 3 : 1}"/>`;
      const text = `<text x="${x}" y="${y - 4}" text-anchor="middle">${esc(truncateLabel(node.label, LABEL_EM))}</text><text x="${x}" y="${y + 14}" text-anchor="middle" opacity="0.7">${esc(truncateLabel(subLabel(node), LABEL_EM + 2))}</text>`;
      const full = 'concept' in node ? `${node.label} — ${node.concept}` : node.label;
      const body = `${rect}${text}<title>${esc(full)}</title>`;
      if (node.kind !== 'variant') return `<g>${body}</g>`;
      const name = `${tideLabel.get(node.tideId) ?? ''} / ${node.label}${selected ? ' (選択中)' : ''}`;
      return `<a class="graph-node" href="${esc(variantHref(node.id))}" aria-label="${esc(name)}"${selected ? ' data-selected="true" aria-current="true"' : ''}>${body}</a>`;
    })
    .join('');
  return `<svg class="graph-svg graph-${orientation}" data-orientation="${orientation}" role="group" aria-label="潮流・亜流グラフ (${orientation === 'rightward' ? '流れは右へ進み、潮流は縦に分岐' : '流れは上へ進み、潮流は横に分岐'})" viewBox="0 0 ${layout.width} ${layout.height}" ${sizeAttributes(layout.width, layout.height, zoom)}>${edges}${nodes}</svg>`;
}
