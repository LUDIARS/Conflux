import { describeIntegration } from '../../../adoption-decisions/domain/decision-rules.ts';
import type { VariantDetail } from '../../../evolution-streams/application/project-overview.ts';
import type { VariantComparison } from '../../../evolution-streams/domain/variant-comparison.ts';
import { describeSelectionState } from '../../../flow-isolation/domain/selection-record.ts';
import { describeRequestState } from '../../../implementation-requests/domain/request-rules.ts';
import type { CommentThread } from '../../../play-feedback/domain/comment-rules.ts';
import { describeTargetState } from '../../../playable-results/domain/result-status.ts';
import type { Artifact } from '../../../playable-results/domain/model.ts';
import { esc } from './escape.ts';

export function conceptSection(d: VariantDetail): string {
  const rules = d.variant.rules.map((r) => `<tr><td>${esc(r.key)}</td><td>${esc(r.text)}</td></tr>`).join('');
  return `<section><h2>${esc(d.tide.title)} / ${esc(d.variant.title)}</h2>
<p><span class="badge">潮流</span> ${esc(d.tide.concept)}</p>
<p><span class="badge">亜流</span> ${esc(d.variant.concept)}</p>
<h3>現在のルール</h3><table><tr><th>ルール</th><th>内容</th></tr>${rules || '<tr><td colspan="2" class="muted">未登録</td></tr>'}</table></section>`;
}

export function comparisonSection(c: VariantComparison | undefined): string {
  if (!c) return '';
  const rows = c.rules
    .map((r) => `<tr class="${r.state === 'same' ? 'muted' : ''}"><td>${esc(r.key)}</td><td>${esc(r.left)}</td><td>${esc(r.right)}</td><td>${esc(r.state)}</td></tr>`)
    .join('');
  return `<section><h2>ルール差分: ${esc(c.left.title)} ⇔ ${esc(c.right.title)}</h2>
<p>${esc(c.left.concept)}<br>⇔ ${esc(c.right.concept)}</p>
<table><tr><th>ルール</th><th>${esc(c.left.title)}</th><th>${esc(c.right.title)}</th><th>差</th></tr>${rows}</table></section>`;
}

export function revisionsSection(d: VariantDetail): string {
  const rows = [...d.revisions]
    .reverse()
    .map((r) => {
      const changes = r.ruleChanges.map((c) => `${esc(c.key)}: ${esc(c.before ?? '∅')} → ${esc(c.after ?? '∅')}`).join('<br>');
      return `<tr><td>${esc(r.createdAt)}</td><td>${esc(r.intent)}<br><span class="muted">${esc(r.summary)}</span></td><td>${changes}</td><td>${esc(r.gitRef.branch)}<br>${esc(r.gitRef.commit ?? '')}</td></tr>`;
    })
    .join('');
  return `<section><h2>改修履歴</h2><table><tr><th>日時</th><th>意図</th><th>ルール変更</th><th>Git</th></tr>${rows || '<tr><td colspan="4" class="muted">なし</td></tr>'}</table></section>`;
}

function artifactLinks(artifacts: readonly Artifact[]): string {
  return artifacts
    .map((a) => `<a href="${esc(a.uri)}" rel="noopener">${esc(a.platform)} (${a.delivery === 'download' ? 'DL' : 'デプロイ可'})</a> <span class="muted">${esc(a.id)}</span>`)
    .join('<br>');
}

export function resultsSection(d: VariantDetail, projectCode: string): string {
  const r = d.result;
  const stateClass = r.target === 'playable' ? 'ok' : r.target === 'failed' || r.target === 'unknown' ? 'bad' : 'warn';
  const past =
    r.lastPlayable && !r.lastPlayable.isTarget
      ? `<p class="warn">過去の試遊可能版 (最新対象ではありません): ${esc(r.lastPlayable.build.commit)}<br>${artifactLinks(r.lastPlayable.artifacts)}</p>`
      : '';
  const builds = [...d.builds]
    .reverse()
    .map((b) => {
      const retry =
        b.state === 'failed' || b.state === 'not_connected'
          ? `<form method="post" action="/projects/${esc(projectCode)}/builds/${esc(b.id)}/retry"><button>失敗内容を確認して再実行</button></form>`
          : '';
      const log = b.logUri ? `<a href="${esc(b.logUri)}" rel="noopener">ログ</a>` : '';
      return `<tr><td>${esc(b.commit)}</td><td>${esc(b.origin)}</td><td>${esc(b.state)}</td><td>${esc(b.failureSummary ?? '')} ${log}</td><td>${retry}</td></tr>`;
    })
    .join('');
  const deployments = [...d.deployments]
    .reverse()
    .map((x) => `<tr><td>${esc(x.requestedAt)}</td><td>${esc(x.environment)}</td><td>${esc(x.artifactId)}</td><td>${esc(x.actorId)}</td><td>${esc(x.state)} ${esc(x.detail ?? '')}</td></tr>`)
    .join('');
  return `<section><h2>試遊成果物</h2>
<p>対象版: ${esc(r.targetCommit ?? '—')} — <strong class="${stateClass}">${esc(describeTargetState(r.target))}</strong></p>
${r.targetArtifacts.length > 0 ? `<p>${artifactLinks(r.targetArtifacts)}</p>` : ''}${past}
<h3>ビルド (Cc フック管理)</h3><table><tr><th>コミット</th><th>契機</th><th>状態</th><th>詳細</th><th></th></tr>${builds || '<tr><td colspan="5" class="muted">なし</td></tr>'}</table>
<h3>デプロイ履歴</h3><table><tr><th>日時</th><th>環境</th><th>成果物</th><th>実行者</th><th>結果</th></tr>${deployments || '<tr><td colspan="5" class="muted">なし</td></tr>'}</table></section>`;
}

export function ratingsSection(d: VariantDetail): string {
  const rows = d.ratings
    .map((s) => {
      const avg = Object.entries(s.averages).map(([k, v]) => `${esc(k)}=${v}`).join(', ');
      return `<tr><td>${esc(s.commit)} ${s.isCurrent ? '<span class="badge">最新対象版</span>' : '<span class="badge">過去の版</span>'}</td><td>${s.count}</td><td>${avg}</td></tr>`;
    })
    .join('');
  return `<section><h2>潮流評価 (プレイした版ごと)</h2><table><tr><th>版</th><th>件数</th><th>平均</th></tr>${rows || '<tr><td colspan="3" class="muted">なし</td></tr>'}</table></section>`;
}

function threadHtml(t: CommentThread): string {
  const c = t.comment;
  const who = c.author.kind === 'human' ? esc(c.author.name) : `AI による整理 (${esc(c.author.agent)}) — 参照: ${esc(c.author.sourceCommentIds.join(', '))}`;
  const build = c.playedBuild ? ` <span class="badge">プレイ版 ${esc(c.playedBuild.commit)}</span>` : '';
  const src = c.source === 'debug-screen' ? ' <span class="badge">デバッグ画面</span>' : '';
  return `<div class="thread${c.author.kind === 'ai-summary' ? ' ai' : ''}"><p><strong>${who}</strong>${build}${src} <span class="muted">${esc(c.createdAt)} ${esc(c.id)}</span><br>${esc(c.body)}</p>${t.replies.map(threadHtml).join('')}</div>`;
}

export function commentsSection(d: VariantDetail): string {
  const traces = d.traces
    .filter((t) => t.requests.length + t.decisions.length + t.summarizedBy.length > 0)
    .map(
      (t) =>
        `<tr><td>${esc(t.commentId)}</td><td>${esc(t.summarizedBy.join(', '))}</td><td>${t.requests.map((r) => esc(`${r.title} (${r.state})`)).join('<br>')}</td><td>${t.decisions.map((x) => esc(`${x.verdict}: ${x.reason}`)).join('<br>')}</td></tr>`,
    )
    .join('');
  return `<section><h2>コメント</h2>${d.threads.map(threadHtml).join('') || '<p class="muted">まだありません</p>'}
<h3>意見の行き先</h3><table><tr><th>元コメント</th><th>AI 整理</th><th>作業依頼</th><th>採否</th></tr>${traces || '<tr><td colspan="4" class="muted">なし</td></tr>'}</table></section>`;
}

export function workSection(d: VariantDetail, projectCode: string): string {
  const rows = [...d.requests]
    .reverse()
    .map((r) => {
      const reconcile =
        r.state === 'unknown' || r.state === 'requested' || r.state === 'not_sent'
          ? `<form method="post" action="/projects/${esc(projectCode)}/requests/${esc(r.id)}/reconcile"><label><input type="checkbox" name="resendIfAbsent" value="1"> 未送信が確定したら再送</label><button>照合</button></form>`
          : '';
      return `<tr><td>${esc(r.title)}<br><span class="muted">${esc(r.selection.workBranch)} ← ${esc(r.selection.baseBranch)}</span></td><td>${esc(r.destinationId)}</td><td>${esc(describeRequestState(r.state))}${r.ccSessionId ? `<br>session ${esc(r.ccSessionId)}` : ''}${r.harnessSelection ? `<br>${esc(describeSelectionState(r.harnessSelection))}` : ''}</td><td>${esc(r.sourceCommentIds.join(', '))}</td><td>${reconcile}</td></tr>`;
    })
    .join('');
  const selections = [...d.selections]
    .reverse()
    .map((s) => `<tr><td>${esc(s.sessionId)}</td><td>${esc(s.selection.workBranch)}</td><td>${esc(describeSelectionState(s.state))} ${esc(s.detail ?? '')}</td></tr>`)
    .join('');
  return `<section><h2>作業依頼 (Cc spawn)</h2><table><tr><th>依頼</th><th>宛先</th><th>状態</th><th>元コメント</th><th></th></tr>${rows || '<tr><td colspan="5" class="muted">なし</td></tr>'}</table>
<h3>Cc harness への流れ選択</h3><table><tr><th>session</th><th>作業ブランチ</th><th>結果</th></tr>${selections || '<tr><td colspan="3" class="muted">なし</td></tr>'}</table></section>`;
}

export function decisionsSection(d: VariantDetail): string {
  const rows = [...d.decisions]
    .reverse()
    .map(
      (x) =>
        `<tr><td>${esc(x.decidedAt)}</td><td>${x.verdict === 'adopted' ? '採用' : '見送り'}</td><td>${esc(x.target.commit ?? '—')}</td><td>${esc(x.reason)}</td><td>${esc(x.decidedBy)}</td><td>${esc(describeIntegration(x.integration))}</td></tr>`,
    )
    .join('');
  return `<section><h2>合流判断の履歴</h2><table><tr><th>日時</th><th>判断</th><th>版</th><th>理由</th><th>判断者</th><th>コード統合</th></tr>${rows || '<tr><td colspan="6" class="muted">なし</td></tr>'}</table></section>`;
}
