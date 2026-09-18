import type { ProjectOverview } from '../../../evolution-streams/application/project-overview.ts';
import type { VariantComparison } from '../../../evolution-streams/domain/variant-comparison.ts';
import { renderDetailPane } from './detail-pane.ts';
import { esc } from './escape.ts';
import { renderGraphPane } from './graph-pane.ts';
import { errorBanner, page } from './layout.ts';
import { renderProjectHeader } from './project-header.ts';
import { projectViewHref, type ProjectViewState } from './view-state.ts';

/** Graph / detail switch for narrow screens; both links keep the selected variant id. */
function viewSwitch(o: ProjectOverview, state: ProjectViewState): string {
  const code = o.workspace.projectCode;
  const link = (view: 'graph' | 'detail', label: string): string =>
    `<a class="switch" href="${esc(projectViewHref(code, state, { view }))}"${state.view === view ? ' aria-current="page"' : ''}>${label}</a>`;
  const selected = o.selected ? `<span class="switch-title">${esc(o.selected.variant.title)}</span>` : '';
  return `<nav class="view-switch narrow-only" aria-label="表示の切替">${link('graph', 'グラフ')}${link('detail', `詳細${selected}`)}</nav>`;
}

/**
 * Project workspace page (CF-GRAPH-001 / CF-WEB-001). Wide screens show graph and detail side by
 * side; narrow screens show the pane named by `state.view`. Both panes read the same overview.
 */
export function renderProjectPage(o: ProjectOverview, state: ProjectViewState, comparison: VariantComparison | undefined, error: string | null): string {
  const ws = o.workspace;
  const title = o.selected ? `${o.selected.variant.title} — ${ws.name} — Conflux` : `${ws.name} — Conflux`;
  return page(
    title,
    `${renderProjectHeader(o)}
<main id="main" class="workspace" data-view="${state.view}">
${errorBanner(error)}
${viewSwitch(o, state)}
<div class="panes">
${renderGraphPane(o, state)}
${renderDetailPane(o, state, comparison)}
</div>
</main>`,
  );
}
