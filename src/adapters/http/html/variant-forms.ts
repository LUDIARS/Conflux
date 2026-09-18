import type { VariantDetail } from '../../../evolution-streams/application/project-overview.ts';
import type { ProjectWorkspace } from '../../../project-workspaces/domain/model.ts';
import { esc } from './escape.ts';
import { field, hidden, option, submit } from './form-controls.ts';

function action(projectCode: string, path: string): string {
  return esc(`/projects/${encodeURIComponent(projectCode)}${path}`);
}

function variantPath(d: VariantDetail, suffix: string): string {
  return `/variants/${encodeURIComponent(d.variant.id)}${suffix}`;
}

function buildOptions(d: VariantDetail): string {
  return [...d.builds]
    .reverse()
    .filter((b) => b.state === 'succeeded')
    .map((b) => option(b.id, `${b.commit}${b.id === d.result.targetBuild?.id ? ' (最新対象版)' : ''}`))
    .join('');
}

export function revisionForm(ws: ProjectWorkspace, d: VariantDetail): string {
  return `<section><h3>改修を記録</h3><form method="post" action="${action(ws.projectCode, variantPath(d, '/revisions'))}">
${field('改修意図', '<input name="intent" required>')}
${field('概要', '<textarea name="summary" rows="3"></textarea>')}
${field('ルール変更', '<textarea name="ruleChanges" rows="3"></textarea>', '1 行 1 件: キー | 変更前 | 変更後。新規は変更前を空、削除は変更後を空')}
${field('Git ブランチ', '<input name="branch" required autocapitalize="off" spellcheck="false">')}
${field('コミット (任意)', '<input name="commit" autocapitalize="off" spellcheck="false">')}
${submit('記録')}</form></section>`;
}

export function commentForm(ws: ProjectWorkspace, d: VariantDetail): string {
  const builds = buildOptions(d);
  return `<section><h3>コメントを書く</h3><form method="post" action="${action(ws.projectCode, variantPath(d, '/comments'))}">
${field('名前', '<input name="author" required autocomplete="nickname">')}
${field('コメント', '<textarea name="body" rows="4" required></textarea>', '一言の感想でも大丈夫です')}
${field('返信先コメント id (任意)', '<input name="parentId" autocapitalize="off" spellcheck="false">')}
${field('プレイした版 (任意)', `<select name="playedBuildId">${option('', '指定しない')}${builds}</select>`)}
${submit('投稿')}</form>
${ratingForm(ws, d, builds)}</section>`;
}

function ratingForm(ws: ProjectWorkspace, d: VariantDetail, builds: string): string {
  const scale = ws.ratingScale;
  if (!scale) return '<p class="warn">評価尺度がプロジェクト設定で未定義のため、評価は受け付けていません。</p>';
  if (!builds) return '<p class="muted">試遊可能なビルドがまだ無いため評価できません。</p>';
  const items = scale.items
    .map((i) => field(`${i.label} (${scale.min}〜${scale.max})`, `<input type="number" inputmode="numeric" name="score.${esc(i.key)}" min="${scale.min}" max="${scale.max}" required>`))
    .join('');
  return `<h3>潮流を評価</h3><form method="post" action="${action(ws.projectCode, variantPath(d, '/ratings'))}">
${field('名前', '<input name="rater" required autocomplete="nickname">')}
${field('プレイした版', `<select name="playedBuildId" required>${builds}</select>`)}${items}${submit('評価')}</form>`;
}

export function requestForm(ws: ProjectWorkspace, d: VariantDetail): string {
  if (ws.spawnDestinations.length === 0) return '<section><h3>Cc へ作業を依頼</h3><p class="warn">spawn 先が事前設定されていません。</p></section>';
  if (!ws.branchNaming) return '<section><h3>Cc へ作業を依頼</h3><p class="warn">本流ブランチの物理命名が未設定のため依頼できません。</p></section>';
  const destinations = ws.spawnDestinations.map((x) => option(x.id, `${x.label} (${x.kind})`)).join('');
  return `<section><h3>Cc へ作業を依頼</h3><form method="post" action="${action(ws.projectCode, '/requests')}">
${hidden('variantId', d.variant.id)}
${field('題名', '<input name="title" required>')}
${field('試したい改善内容', '<textarea name="brief" rows="4" required></textarea>')}
${field('作業名', '<input name="task" required autocapitalize="off" spellcheck="false">', '英小文字・数字・ハイフン')}
${field('元コメント id (任意)', '<input name="sourceCommentIds" autocapitalize="off" spellcheck="false">', 'カンマ区切り')}
${field('宛先', `<select name="destinationId">${destinations}</select>`)}
${field('依頼者', '<input name="requestedBy" required autocomplete="nickname">')}
${submit('依頼')}</form></section>`;
}

export function decisionForm(ws: ProjectWorkspace, d: VariantDetail): string {
  return `<section><h3>合流 (正式ルールへの採否)</h3>
<p class="muted">採用には対象版の試遊可能な成果物が必要です。コード統合は Rv/GitHub の経路で行われ、統合報告が届くまで「未統合」と表示します。</p>
<form method="post" action="${action(ws.projectCode, '/decisions')}">
${hidden('variantId', d.variant.id)}
${field('判断', `<select name="verdict">${option('adopted', '採用 (合流)')}${option('declined', '見送り')}</select>`)}
${field('対象版コミット', `<input name="commit" value="${esc(d.result.targetCommit ?? '')}" autocapitalize="off" spellcheck="false">`)}
${field('理由', '<textarea name="reason" rows="3" required></textarea>')}
${field('判断材料のコメント id (任意)', '<input name="relatedCommentIds" autocapitalize="off" spellcheck="false">', 'カンマ区切り')}
${field('判断者', '<input name="decidedBy" required autocomplete="nickname">')}
${submit('記録')}</form></section>`;
}

export function deployForm(ws: ProjectWorkspace, d: VariantDetail): string {
  const deployable = d.result.targetArtifacts.filter((a) => a.delivery === 'deployable');
  if (deployable.length === 0) return '';
  if (ws.deploy.environments.length === 0) return '<section><h3>デプロイ</h3><p class="warn">デプロイ環境が未設定です。</p></section>';
  const artifacts = deployable.map((a) => option(a.id, `${a.platform} ${a.commit}`)).join('');
  const envs = ws.deploy.environments.map((e) => option(e, e)).join('');
  return `<section><h3>デプロイ (管理職以上)</h3>
<p class="muted">実行時に Cc で本人と役職を確認します。この画面では権限を判定しません。自動ビルドの成功だけではデプロイしません。</p>
<form method="post" action="${action(ws.projectCode, '/deployments')}">
${field('成果物', `<select name="artifactId">${artifacts}</select>`)}
${field('環境', `<select name="environment">${envs}</select>`)}
${field('確認: 成果物 id を再入力', '<input name="confirmArtifactId" required autocapitalize="off" spellcheck="false">')}
${field('確認: 環境名を再入力', '<input name="confirmEnvironment" required autocapitalize="off" spellcheck="false">')}
${field('Cc 本人確認トークン', '<input name="actorToken" type="password" autocomplete="off">')}
${submit('デプロイ')}</form></section>`;
}
