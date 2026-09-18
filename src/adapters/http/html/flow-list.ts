import type { Tide, Variant } from '../../../evolution-streams/domain/model.ts';
import { esc } from './escape.ts';
import { projectViewHref, type ProjectViewState } from './view-state.ts';

/**
 * Text list of tides and their variants. It complements the graph (small screens, screen
 * readers, many nodes) and links to the same selection as the graph nodes.
 */
export function renderFlowList(
  projectCode: string,
  tides: readonly Tide[],
  variants: readonly Variant[],
  state: ProjectViewState,
  selectedVariantId: string | undefined,
): string {
  if (tides.length === 0) return '';
  const groups = tides
    .map((tide) => {
      const items = variants
        .filter((v) => v.tideId === tide.id)
        .map((v) => {
          const current = v.id === selectedVariantId;
          const href = projectViewHref(projectCode, state, { variantId: v.id, view: 'detail', compareId: undefined });
          return `<li><a class="flow-item" href="${esc(href)}"${current ? ' aria-current="true"' : ''}><span class="flow-title">${esc(v.title)}</span><span class="flow-concept muted">${esc(v.concept)}</span></a></li>`;
        })
        .join('');
      return `<li class="flow-tide"><p class="flow-tide-title"><span class="badge">潮流</span> ${esc(tide.title)}</p>
<ul class="flow-variants">${items || '<li class="muted">亜流はまだありません</li>'}</ul></li>`;
    })
    .join('');
  return `<nav class="flow-list" aria-label="流れの一覧"><h3>流れの一覧</h3><ul>${groups}</ul></nav>`;
}
