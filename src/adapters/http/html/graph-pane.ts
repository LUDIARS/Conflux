import type { ProjectOverview } from '../../../evolution-streams/application/project-overview.ts';
import { esc } from './escape.ts';
import { renderFlowForms } from './flow-forms.ts';
import { renderFlowList } from './flow-list.ts';
import { renderGraphViewport } from './graph-viewport.ts';
import type { ProjectViewState } from './view-state.ts';

function officialSection(o: ProjectOverview): string {
  const items = o.official
    .map(({ decision, integrationLabel }) => {
      const v = o.variants.find((x) => x.id === decision.variantId);
      return `<li><strong>${esc(v?.title ?? decision.variantId)}</strong> <code>${esc(decision.target.commit ?? '')}</code><br>${esc(decision.reason)}<br><span class="muted">コード統合: ${esc(integrationLabel)}</span></li>`;
    })
    .join('');
  return `<details class="panel"><summary>正式ルール (合流済みの判断 ${o.official.length} 件)</summary>${items ? `<ul class="plain">${items}</ul>` : '<p class="muted">まだありません</p>'}</details>`;
}

/** Graph side: graph with controls, the equivalent text list, official rules and creation forms. */
export function renderGraphPane(o: ProjectOverview, state: ProjectViewState): string {
  const code = o.workspace.projectCode;
  const selectedId = o.selected?.variant.id;
  const graph =
    o.tides.length === 0
      ? '<div class="empty"><p class="muted">まだ潮流がありません。下の「流れを増やす」から最初の潮流を作ってください。</p></div>'
      : `${renderGraphViewport(o.graph, code, state, selectedId)}${renderFlowList(code, o.tides, o.variants, state, selectedId)}`;
  return `<section class="pane pane-graph" id="graph" aria-labelledby="graph-title">
<h2 id="graph-title">流れ</h2>
${graph}
${officialSection(o)}
${renderFlowForms(code, o.tides, o.variants)}
</section>`;
}
