import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildThreads, planComment } from '../../src/play-feedback/domain/comment-rules.ts';
import { admitDebugPost } from '../../src/play-feedback/domain/debug-intake.ts';
import type { Comment, Rating } from '../../src/play-feedback/domain/model.ts';
import { planRating, summarizeRatings } from '../../src/play-feedback/domain/rating-rules.ts';
import { traceComment } from '../../src/play-feedback/domain/trace.ts';

const at = '2026-09-18T00:00:00.000Z';
const variant = { id: 'v1', projectCode: 'KD', tideId: 't1' };
const build = { id: 'b1', projectCode: 'KD', variantId: 'v1', commit: 'aaa1111' };
const human = (id: string, body = 'x', parentId?: string): Comment => ({
  id,
  projectCode: 'KD',
  tideId: 't1',
  variantId: 'v1',
  author: { kind: 'human', name: 'p' },
  body,
  source: 'cf-ui',
  ...(parentId ? { parentId } : {}),
  createdAt: at,
});

describe('comments', () => {
  it('accepts a one-word impression', () => {
    const r = planComment({ variant }, { projectCode: 'KD', variantId: 'v1', author: { kind: 'human', name: 'p' }, body: '楽しい', source: 'cf-ui' }, { id: 'c', at });
    assert.equal(r.ok, true);
  });

  it('keeps AI summaries distinct and requires human sources', () => {
    const noSources = planComment({ variant, sources: [] }, { projectCode: 'KD', variantId: 'v1', author: { kind: 'ai-summary', agent: 'claude', sourceCommentIds: ['c1'] }, body: 's', source: 'ai' }, { id: 'c', at });
    assert.equal(noSources.ok, false);
    const ok = planComment({ variant, sources: [human('c1')] }, { projectCode: 'KD', variantId: 'v1', author: { kind: 'ai-summary', agent: 'claude', sourceCommentIds: ['c1'] }, body: 's', source: 'ai' }, { id: 'c', at });
    assert.equal(ok.ok && ok.value.author.kind, 'ai-summary');
  });

  it('refuses a played build of another variant', () => {
    const r = planComment({ variant, build: { ...build, variantId: 'v2' } }, { projectCode: 'KD', variantId: 'v1', author: { kind: 'human', name: 'p' }, body: 'x', source: 'cf-ui', playedBuildId: 'b1' }, { id: 'c', at });
    assert.equal(r.ok ? null : r.error.code, 'build_mismatch');
  });

  it('threads replies under their parent', () => {
    const threads = buildThreads([human('a'), human('b', 'y', 'a')]);
    assert.equal(threads.length, 1);
    assert.equal(threads[0]?.replies[0]?.comment.id, 'b');
  });
});

describe('debug intake', () => {
  const claim = { projectCode: 'KD', variantId: 'v1', buildId: 'b1', commit: 'aaa1111' };
  it('is closed for projects outside Cf Flow', () => {
    const r = admitDebugPost({ intakeOpen: false, variant, build, claim });
    assert.equal(r.ok ? null : r.error.code, 'conflux_flow_not_enabled');
  });
  it('binds to the reported build and rejects a commit mismatch', () => {
    assert.equal(admitDebugPost({ intakeOpen: true, variant, build, claim }).ok, true);
    assert.equal(admitDebugPost({ intakeOpen: true, variant, build, claim: { ...claim, commit: 'bbb2222' } }).ok, false);
  });
});

describe('ratings', () => {
  const scale = { min: 1, max: 5, items: [{ key: 'fun', label: 'f' }] };
  const draft = { projectCode: 'KD', tideId: 't1', variantId: 'v1', playedBuild: { buildId: 'b1', commit: 'aaa1111' }, rater: 'p', scores: { fun: 4 }, source: 'cf-ui' as const };
  it('needs a declared scale', () => {
    assert.equal(planRating(undefined, draft, { id: 'r', at }).ok, false);
    assert.equal(planRating(scale, draft, { id: 'r', at }).ok, true);
    assert.equal(planRating(scale, { ...draft, scores: { fun: 9 } }, { id: 'r', at }).ok, false);
  });

  it('never presents an older build rating as the current build', () => {
    const r = (id: string, buildId: string, fun: number): Rating => ({ ...draft, id, playedBuild: { buildId, commit: buildId }, scores: { fun }, scale, createdAt: at });
    const summary = summarizeRatings([r('1', 'old', 5), r('2', 'new', 2)], 'new');
    assert.equal(summary[0]?.buildId, 'new');
    assert.equal(summary[0]?.isCurrent, true);
    assert.equal(summary.find((s) => s.buildId === 'old')?.isCurrent, false);
    assert.equal(summarizeRatings([r('1', 'old', 5)], 'new')[0]?.isCurrent, false);
  });
});

describe('trace', () => {
  it('follows an opinion through its AI summary to requests and decisions', () => {
    const t = traceComment('c1', {
      summaries: [{ id: 's1', sourceCommentIds: ['c1'] }],
      requests: [{ id: 'q1', title: 'T', state: 'spawned', sourceCommentIds: ['s1'] }],
      decisions: [{ id: 'd1', verdict: 'declined', reason: 'R', relatedCommentIds: ['c1'] }],
    });
    assert.deepEqual(t.summarizedBy, ['s1']);
    assert.equal(t.requests[0]?.id, 'q1');
    assert.equal(t.decisions[0]?.reason, 'R');
  });
});
