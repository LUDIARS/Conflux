import type { ProjectOverview } from '../../../evolution-streams/application/project-overview.ts';
import { mainlineBranchName } from '../../../evolution-streams/domain/branch-naming.ts';
import type { VariantComparison } from '../../../evolution-streams/domain/variant-comparison.ts';
import { describeTargetState } from '../../../playable-results/domain/result-status.ts';
import { renderTabNav, renderTabPanel } from './detail-tabs.ts';
import { esc } from './escape.ts';
import { DETAIL_TABS, projectViewHref, type ProjectViewState } from './view-state.ts';

function emptyDetail(o: ProjectOverview, state: ProjectViewState): string {
  if (state.variantId) {
    return `<div class="empty" role="status"><p class="warn">選択された亜流はこのプロジェクトにありません (削除・別プロジェクトの可能性)。</p>
<p><a class="button-link" href="${esc(projectViewHref(o.workspace.projectCode, state, { variantId: undefined, view: 'graph' }))}">グラフから選び直す</a></p></div>`;
  }
  if (o.variants.length === 0) return '<div class="empty"><p class="muted">亜流がまだありません。グラフ面の「流れを増やす」から潮流と亜流を作ると、ここに詳細が表示されます。</p></div>';
  return '<div class="empty"><p class="muted">グラフか流れの一覧から亜流を選ぶと、コンセプト・ルール差分・対話・成果物・作業依頼・合流判断を表示します。</p></div>';
}

/** Detail of the selected variant; the header always names project, tide and variant so context is not lost. */
export function renderDetailPane(o: ProjectOverview, state: ProjectViewState, comparison: VariantComparison | undefined): string {
  const d = o.selected;
  const code = o.workspace.projectCode;
  const naming = o.workspace.branchNaming;
  const back = `<a class="back-link narrow-only" href="${esc(projectViewHref(code, state, { view: 'graph' }))}">← グラフへ戻る</a>`;
  if (!d) return `<section class="pane pane-detail" id="detail" aria-labelledby="detail-title">${back}<h2 id="detail-title">詳細</h2>${emptyDetail(o, state)}</section>`;
  const branch = naming ? mainlineBranchName(naming, d.tide.slug, d.variant.slug) : '本流命名 未設定';
  const tabLabel = DETAIL_TABS.find((t) => t.id === state.tab)?.label ?? '';
  return `<section class="pane pane-detail" id="detail" aria-labelledby="detail-title">${back}
<div class="detail-head">
<p class="crumb muted"><span class="badge">潮流</span> ${esc(d.tide.title)}</p>
<h2 id="detail-title">${esc(d.variant.title)}</h2>
<p class="branch"><code>${esc(branch)}</code></p>
<p class="muted">成果物: ${esc(describeTargetState(d.result.target))}</p>
</div>
${renderTabNav(code, state, d)}
<div class="tab-panel" role="region" aria-label="${esc(tabLabel)}">${renderTabPanel({ overview: o, detail: d, state, comparison })}</div>
</section>`;
}
