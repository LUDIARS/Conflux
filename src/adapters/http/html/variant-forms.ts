import type { VariantDetail } from '../../../evolution-streams/application/project-overview.ts';
import type { ProjectWorkspace } from '../../../project-workspaces/domain/model.ts';
import { esc } from './escape.ts';

function action(projectCode: string, path: string): string {
  return `/projects/${encodeURIComponent(projectCode)}${path}`;
}

function buildOptions(d: VariantDetail): string {
  return [...d.builds]
    .reverse()
    .filter((b) => b.state === 'succeeded')
    .map((b) => `<option value="${esc(b.id)}">${esc(b.commit)}${b.id === d.result.targetBuild?.id ? ' (最新対象版)' : ''}</option>`)
    .join('');
}

export function revisionForm(ws: ProjectWorkspace, d: VariantDetail): string {
  return `<section><h2>改修を記録</h2><form method="post" action="${action(ws.projectCode, `/variants/${esc(d.variant.id)}/revisions`)}">
<input name="intent" placeholder="改修意図" required>
<textarea name="summary" placeholder="概要"></textarea>
<textarea name="ruleChanges" placeholder="ルール変更 (1 行 1 件: キー | 変更前 | 変更後。新規は変更前を空、削除は変更後を空)"></textarea>
<input name="branch" placeholder="Git ブランチ" required><input name="commit" placeholder="コミット (任意)">
<button>記録</button></form></section>`;
}

export function commentForm(ws: ProjectWorkspace, d: VariantDetail): string {
  const builds = buildOptions(d);
  return `<section><h2>コメントを書く</h2><form method="post" action="${action(ws.projectCode, `/variants/${esc(d.variant.id)}/comments`)}">
<input name="author" placeholder="名前" required>
<textarea name="body" placeholder="一言の感想でも大丈夫です" required></textarea>
<input name="parentId" placeholder="返信先コメント id (任意)">
<select name="playedBuildId"><option value="">プレイした版 (任意)</option>${builds}</select>
<button>投稿</button></form>
${ratingForm(ws, d, builds)}</section>`;
}

function ratingForm(ws: ProjectWorkspace, d: VariantDetail, builds: string): string {
  const scale = ws.ratingScale;
  if (!scale) return '<p class="warn">評価尺度がプロジェクト設定で未定義のため、評価は受け付けていません。</p>';
  if (!builds) return '<p class="muted">試遊可能なビルドがまだ無いため評価できません。</p>';
  const items = scale.items
    .map((i) => `<label>${esc(i.label)} <input type="number" name="score.${esc(i.key)}" min="${scale.min}" max="${scale.max}" required></label>`)
    .join('');
  return `<h3>潮流を評価</h3><form method="post" action="${action(ws.projectCode, `/variants/${esc(d.variant.id)}/ratings`)}">
<input name="rater" placeholder="名前" required><select name="playedBuildId" required>${builds}</select>${items}<button>評価</button></form>`;
}

export function requestForm(ws: ProjectWorkspace, d: VariantDetail): string {
  if (ws.spawnDestinations.length === 0) return '<section><h2>Cc へ作業を依頼</h2><p class="warn">spawn 先が事前設定されていません。</p></section>';
  if (!ws.branchNaming) return '<section><h2>Cc へ作業を依頼</h2><p class="warn">本流ブランチの物理命名が未設定のため依頼できません。</p></section>';
  const destinations = ws.spawnDestinations.map((x) => `<option value="${esc(x.id)}">${esc(x.label)} (${esc(x.kind)})</option>`).join('');
  return `<section><h2>Cc へ作業を依頼</h2><form method="post" action="${action(ws.projectCode, '/requests')}">
<input type="hidden" name="variantId" value="${esc(d.variant.id)}">
<input name="title" placeholder="題名" required><textarea name="brief" placeholder="試したい改善内容" required></textarea>
<input name="task" placeholder="作業名 (英小文字・数字・ハイフン)" required>
<input name="sourceCommentIds" placeholder="元コメント id (カンマ区切り)">
<select name="destinationId">${destinations}</select><input name="requestedBy" placeholder="依頼者" required>
<button>依頼</button></form></section>`;
}

export function decisionForm(ws: ProjectWorkspace, d: VariantDetail): string {
  return `<section><h2>合流 (正式ルールへの採否)</h2>
<p class="muted">採用には対象版の試遊可能な成果物が必要です。コード統合は Rv/GitHub の経路で行われ、統合報告が届くまで「未統合」と表示します。</p>
<form method="post" action="${action(ws.projectCode, '/decisions')}">
<input type="hidden" name="variantId" value="${esc(d.variant.id)}">
<select name="verdict"><option value="adopted">採用 (合流)</option><option value="declined">見送り</option></select>
<input name="commit" placeholder="対象版コミット" value="${esc(d.result.targetCommit ?? '')}">
<textarea name="reason" placeholder="理由" required></textarea>
<input name="relatedCommentIds" placeholder="判断材料のコメント id (カンマ区切り)">
<input name="decidedBy" placeholder="判断者" required><button>記録</button></form></section>`;
}

export function deployForm(ws: ProjectWorkspace, d: VariantDetail): string {
  const deployable = d.result.targetArtifacts.filter((a) => a.delivery === 'deployable');
  if (deployable.length === 0) return '';
  if (ws.deploy.environments.length === 0) return '<section><h2>デプロイ</h2><p class="warn">デプロイ環境が未設定です。</p></section>';
  const artifacts = deployable.map((a) => `<option value="${esc(a.id)}">${esc(a.platform)} ${esc(a.commit)}</option>`).join('');
  const envs = ws.deploy.environments.map((e) => `<option value="${esc(e)}">${esc(e)}</option>`).join('');
  return `<section><h2>デプロイ (管理職以上)</h2>
<p class="muted">実行時に Cc で本人と役職を確認します。自動ビルドの成功だけではデプロイしません。</p>
<form method="post" action="${action(ws.projectCode, '/deployments')}">
<select name="artifactId">${artifacts}</select><select name="environment">${envs}</select>
<label><input name="confirmArtifactId" placeholder="確認: 成果物 id を再入力" required></label>
<label><input name="confirmEnvironment" placeholder="確認: 環境名を再入力" required></label>
<input name="actorToken" type="password" placeholder="Cc 本人確認トークン" autocomplete="off">
<button>デプロイ</button></form></section>`;
}
