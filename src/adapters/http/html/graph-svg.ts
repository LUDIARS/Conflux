import type { FlowGraph } from '../../../evolution-streams/domain/flow-graph.ts';
import { LAYOUT, layoutFlowGraph } from '../../../evolution-streams/domain/graph-layout.ts';
import { esc } from './escape.ts';

const EDGE_STYLE: Readonly<Record<string, string>> = {
  contains: 'stroke="currentColor" stroke-opacity="0.35"',
  branched: 'stroke="#f59e0b" stroke-dasharray="4 3"',
  merged: 'stroke="#8b5cf6" stroke-width="2"',
};

const NODE_FILL: Readonly<Record<string, string>> = { official: '#8b5cf6', tide: '#3b82f6', variant: '#22c55e' };

/**
 * Renders the flow graph as inline SVG. Variant nodes link to the same page with
 * `?variant=<id>`, so the selected node and the detail pane share one id.
 */
export function renderGraphSvg(graph: FlowGraph, projectCode: string, selectedVariantId: string | undefined): string {
  const layout = layoutFlowGraph(graph);
  const w = LAYOUT.nodeWidth;
  const h = LAYOUT.nodeHeight;
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
      const sub = node.kind === 'variant' ? (node.mainlineBranch ?? '本流命名 未設定') : node.kind === 'tide' ? '潮流' : '';
      const text = `<text x="${x}" y="${y - 4}" text-anchor="middle">${esc(node.label)}</text><text x="${x}" y="${y + 14}" text-anchor="middle" opacity="0.7">${esc(sub)}</text>`;
      const body = `${rect}${text}<title>${esc('concept' in node ? node.concept : node.label)}</title>`;
      return node.kind === 'variant'
        ? `<a href="/projects/${encodeURIComponent(projectCode)}?variant=${encodeURIComponent(node.id)}">${body}</a>`
        : `<g>${body}</g>`;
    })
    .join('');
  return `<svg role="img" aria-label="潮流・亜流グラフ" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">${edges}${nodes}</svg>`;
}
