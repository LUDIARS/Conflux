import type { ProjectOverview } from '../../../evolution-streams/application/project-overview.ts';
import { describeFlowObservation } from '../../../project-workspaces/domain/workspace-rules.ts';
import { esc } from './escape.ts';

function namingText(o: ProjectOverview): string {
  const naming = o.workspace.branchNaming;
  if (!naming) return '本流命名: 未設定 (未決事項)';
  return `本流命名: ${naming.mainline === 'suffix-main' ? `${naming.evolutionPrefix}/潮流/亜流/main` : `${naming.evolutionPrefix}/潮流/亜流`}`;
}

/**
 * Project context (always visible) plus technical settings folded away, so the Cc report and
 * branch naming stay reachable without being the first thing on screen.
 */
export function renderProjectHeader(o: ProjectOverview): string {
  const ws = o.workspace;
  const flow = ws.flowObservation;
  const flowClass = flow.state === 'enabled' ? 'ok' : flow.state === 'disabled' ? 'muted' : 'warn';
  return `<header class="topbar">
<nav class="crumbs" aria-label="現在地"><a href="/">プロジェクト一覧</a><span aria-hidden="true"> / </span><span aria-current="page"><strong>${esc(ws.name)}</strong> <span class="muted">(${esc(ws.projectCode)})</span></span></nav>
<details class="settings"><summary>設定と接続状態 <span class="${flowClass}">● ${esc(describeFlowObservation(flow))}</span></summary>
<div class="settings-body">
<p class="${flowClass}">${esc(describeFlowObservation(flow))}</p>
<form method="post" action="/projects/${esc(encodeURIComponent(ws.projectCode))}/flow-status/refresh"><button type="submit">Cc に再照会</button></form>
<p class="muted">${esc(namingText(o))}</p>
<p class="muted">Rv/GitHub のワークフロー設定は Cc 側の独立設定で、Cf からは変更しません。</p>
</div></details>
</header>`;
}
