import type { FlowGraph } from '../../../evolution-streams/domain/flow-graph.ts';
import { esc } from './escape.ts';
import { describeGraphZoom, FIT_ZOOM, DEFAULT_ZOOM, stepGraphZoom, type GraphZoom } from './graph-zoom.ts';
import { renderGraphSvg } from './graph-svg.ts';
import { projectViewHref, type ProjectViewState } from './view-state.ts';

function zoomLink(label: string, ariaLabel: string, key: string, href: string | undefined, current: boolean): string {
  if (!href) return `<span class="tool" aria-disabled="true" title="${esc(ariaLabel)}">${esc(label)}</span>`;
  return `<a class="tool" href="${esc(href)}" data-zoom-key="${esc(key)}" aria-label="${esc(ariaLabel)}"${current ? ' aria-current="true"' : ''}>${esc(label)}</a>`;
}

/** Scroll buttons do nothing without the helper script, so they start hidden and the script reveals them. */
function panButton(label: string, ariaLabel: string, dx: number, dy: number): string {
  return `<button type="button" class="tool" data-pan="${dx},${dy}" aria-label="${esc(ariaLabel)}" hidden>${label}</button>`;
}

const LEGEND = `<p class="legend muted"><span class="swatch official"></span>正式ルール <span class="swatch tide"></span>潮流 <span class="swatch variant"></span>亜流 <span class="line branched"></span>分岐 <span class="line merged"></span>合流</p>`;

/**
 * Graph with its own controls: fit / zoom links work without script, the scroll area moves
 * with touch, wheel, scrollbars or arrow keys, and pan buttons are added by the helper script.
 */
export function renderGraphViewport(graph: FlowGraph, projectCode: string, state: ProjectViewState, selectedVariantId: string | undefined): string {
  const href = (zoom: GraphZoom | undefined): string | undefined => (zoom ? projectViewHref(projectCode, state, { zoom }) : undefined);
  const zoomIn = stepGraphZoom(state.zoom, 1);
  const zoomOut = stepGraphZoom(state.zoom, -1);
  const isFit = state.zoom.kind === 'fit';
  const isActual = state.zoom.kind === 'scale' && state.zoom.value === 1;
  const variantHref = (variantId: string): string => projectViewHref(projectCode, state, { variantId, view: 'detail', compareId: undefined });
  return `<div class="graph-viewport" data-graph-viewport>
<div class="graph-toolbar" role="toolbar" aria-label="グラフの表示操作">
${zoomLink('全体', '全体を表示', 'fit', href(FIT_ZOOM), isFit)}
${zoomLink('−', '縮小', 'out', href(zoomOut), false)}
${zoomLink('＋', '拡大', 'in', href(zoomIn), false)}
${zoomLink('等倍', '等倍で表示', 'reset', href(DEFAULT_ZOOM), isActual)}
<span class="zoom-level" aria-live="polite">${esc(describeGraphZoom(state.zoom))}</span>
<span class="pan-group">${panButton('←', '左へ移動', -1, 0)}${panButton('↑', '上へ移動', 0, -1)}${panButton('↓', '下へ移動', 0, 1)}${panButton('→', '右へ移動', 1, 0)}</span>
</div>
<div class="graph-scroll${isFit ? ' fit' : ''}" tabindex="0" data-graph-scroll aria-label="グラフ表示領域 (矢印キーで移動、+ と - で拡大縮小、0 で全体表示)">
${renderGraphSvg(graph, selectedVariantId, state.zoom, variantHref)}
</div>
${LEGEND}
</div>`;
}
