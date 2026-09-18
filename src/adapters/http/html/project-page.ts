import type { ProjectOverview } from '../../../evolution-streams/application/project-overview.ts';
import type { VariantComparison } from '../../../evolution-streams/domain/variant-comparison.ts';
import { describeFlowObservation } from '../../../project-workspaces/domain/workspace-rules.ts';
import { esc } from './escape.ts';
import { renderGraphSvg } from './graph-svg.ts';
import { errorBanner, page } from './layout.ts';
import { commentForm, decisionForm, deployForm, requestForm, revisionForm } from './variant-forms.ts';
import {
  commentsSection,
  comparisonSection,
  conceptSection,
  decisionsSection,
  ratingsSection,
  resultsSection,
  revisionsSection,
  workSection,
} from './variant-sections.ts';

function header(o: ProjectOverview): string {
  const ws = o.workspace;
  const flow = ws.flowObservation;
  const flowClass = flow.state === 'enabled' ? 'ok' : flow.state === 'disabled' ? 'muted' : 'warn';
  const naming = ws.branchNaming
    ? `本流命名: ${ws.branchNaming.mainline === 'suffix-main' ? `${ws.branchNaming.evolutionPrefix}/潮流/亜流/main` : `${ws.branchNaming.evolutionPrefix}/潮流/亜流`}`
    : '本流命名: 未設定 (未決事項)';
  return `<header><h1><a href="/">Conflux</a> / ${esc(ws.name)} <span class="muted">(${esc(ws.projectCode)})</span></h1>
<span class="${flowClass}">${esc(describeFlowObservation(flow))}</span>
<form method="post" action="/projects/${esc(ws.projectCode)}/flow-status/refresh" style="display:inline"><button>Cc に再照会</button></form>
<span class="muted">${esc(naming)}</span>
<span class="muted">Rv/GitHub のワークフロー設定は Cc 側の独立設定で、Cf からは変更しません。</span></header>`;
}

function officialSection(o: ProjectOverview): string {
  const rows = o.official
    .map(({ decision, integrationLabel }) => {
      const v = o.variants.find((x) => x.id === decision.variantId);
      return `<tr><td>${esc(v?.title ?? decision.variantId)}</td><td>${esc(decision.target.commit ?? '')}</td><td>${esc(decision.reason)}</td><td>${esc(integrationLabel)}</td></tr>`;
    })
    .join('');
  return `<section><h2>正式ルール (合流済みの判断)</h2><table><tr><th>亜流</th><th>版</th><th>理由</th><th>コード統合</th></tr>${rows || '<tr><td colspan="4" class="muted">まだありません</td></tr>'}</table></section>`;
}

function flowForms(o: ProjectOverview): string {
  const code = esc(o.workspace.projectCode);
  const tides = o.tides.map((t) => `<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('');
  const variants = o.variants.map((v) => `<option value="${esc(v.id)}">${esc(v.title)}</option>`).join('');
  return `<section><h2>流れを増やす</h2>
<form method="post" action="/projects/${code}/tides"><h3>潮流</h3><input name="slug" placeholder="識別名 (英小文字)" required><input name="title" placeholder="名前" required><textarea name="concept" placeholder="コンセプト" required></textarea><button>潮流を作る</button></form>
${tides ? `<form method="post" action="/projects/${code}/variants"><h3>亜流</h3><select name="tideId">${tides}</select><input name="slug" placeholder="識別名 (英小文字)" required><input name="title" placeholder="名前" required><textarea name="concept" placeholder="コンセプト" required></textarea><textarea name="rules" placeholder="ルール (1 行 1 件: キー: 内容)"></textarea><select name="branchedFromVariantId"><option value="">分岐元なし</option>${variants}</select><input name="branchedFromCommit" placeholder="分岐点コミット (任意)"><button>亜流を作る</button></form>` : ''}</section>`;
}

function compareForm(o: ProjectOverview): string {
  if (!o.selected || o.variants.length < 2) return '';
  const options = o.variants
    .filter((v) => v.id !== o.selected?.variant.id)
    .map((v) => `<option value="${esc(v.id)}">${esc(v.title)}</option>`)
    .join('');
  return `<form method="get" action="/projects/${esc(o.workspace.projectCode)}"><input type="hidden" name="variant" value="${esc(o.selected.variant.id)}"><select name="compare">${options}</select><button>ルールを比較</button></form>`;
}

export function renderProjectPage(o: ProjectOverview, comparison: VariantComparison | undefined, error: string | null): string {
  const d = o.selected;
  const ws = o.workspace;
  const detail = d
    ? [
        conceptSection(d),
        compareForm(o),
        comparisonSection(comparison),
        revisionsSection(d),
        resultsSection(d, ws.projectCode),
        deployForm(ws, d),
        ratingsSection(d),
        commentsSection(d),
        commentForm(ws, d),
        workSection(d, ws.projectCode),
        requestForm(ws, d),
        decisionsSection(d),
        decisionForm(ws, d),
        revisionForm(ws, d),
      ].join('')
    : '<section class="muted">グラフの亜流を選ぶと、コンセプト・改修・評価・成果物・作業依頼・合流判断を表示します。</section>';
  return page(
    `${ws.name} — Conflux`,
    `${header(o)}<main>${errorBanner(error)}<section><h2>流れのグラフ</h2>${renderGraphSvg(o.graph, ws.projectCode, d?.variant.id)}</section>${officialSection(o)}${detail}${flowForms(o)}</main>`,
  );
}

export function renderProjectIndex(projects: readonly { readonly code: string; readonly name: string; readonly flow: string }[]): string {
  const rows = projects.map((p) => `<tr><td><a href="/projects/${esc(p.code)}">${esc(p.name)}</a></td><td>${esc(p.code)}</td><td>${esc(p.flow)}</td></tr>`).join('');
  return page(
    'Conflux',
    `<header><h1>Conflux</h1><span class="muted">遊ぶ → 話す → 選ぶ → Cc で実装 → 成果物で確かめる</span></header>
<main><section><h2>プロジェクト</h2><table><tr><th>名前</th><th>コード</th><th>Cf Flow (Cc 報告)</th></tr>${rows || '<tr><td colspan="3" class="muted">プロジェクト設定は PUT /api/projects/:code で登録します</td></tr>'}</table></section></main>`,
  );
}
