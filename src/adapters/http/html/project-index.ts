import { esc } from './escape.ts';
import { page } from './layout.ts';

export interface ProjectIndexEntry {
  readonly code: string;
  readonly name: string;
  readonly flow: string;
}

/** Project selection: the entry point of the Web UI. */
export function renderProjectIndex(projects: readonly ProjectIndexEntry[]): string {
  const items = projects
    .map(
      (p) =>
        `<li><a class="project-card" href="/projects/${esc(encodeURIComponent(p.code))}"><strong>${esc(p.name)}</strong><span class="muted">${esc(p.code)}</span><span class="muted small">Cf Flow (Cc 報告): ${esc(p.flow)}</span></a></li>`,
    )
    .join('');
  const body = items
    ? `<ul class="project-list">${items}</ul>`
    : '<div class="empty"><p class="muted">プロジェクトはまだありません。プロジェクト設定は <code>PUT /api/projects/:code</code> で登録します。</p></div>';
  return page(
    'Conflux',
    `<header class="topbar"><h1>Conflux</h1><p class="muted">遊ぶ → 話す → 選ぶ → Cc で実装 → 成果物で確かめる</p></header>
<main id="main" class="index"><section class="pane"><h2>プロジェクトを選ぶ</h2>${body}</section></main>`,
  );
}
