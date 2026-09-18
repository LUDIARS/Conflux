import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import admitDebugPostContract from '../../contracts/admit-debug-post.contract.ts';
import applyIntegrationReportContract from '../../contracts/apply-integration-report.contract.ts';
import applyRuleChangesContract from '../../contracts/apply-rule-changes.contract.ts';
import planCommentContract from '../../contracts/plan-comment.contract.ts';
import planDecisionContract from '../../contracts/plan-decision.contract.ts';
import planFlowBuildContract from '../../contracts/plan-flow-build.contract.ts';
import planWorkspaceContract from '../../contracts/plan-workspace.contract.ts';
import projectFlowGraphContract from '../../contracts/project-flow-graph.contract.ts';
import summarizeRatingsContract from '../../contracts/summarize-ratings.contract.ts';
import variantResultStatusContract from '../../contracts/variant-result-status.contract.ts';
import { applyIntegrationReport, planDecision, type IntegrationReport } from '../../src/adoption-decisions/domain/decision-rules.ts';
import type { AdoptionDecision } from '../../src/adoption-decisions/domain/model.ts';
import { projectFlowGraph } from '../../src/evolution-streams/domain/flow-graph.ts';
import { applyRuleChanges } from '../../src/evolution-streams/domain/flow-rules.ts';
import type { Tide, Variant } from '../../src/evolution-streams/domain/model.ts';
import { planComment, type CommentDraft } from '../../src/play-feedback/domain/comment-rules.ts';
import { admitDebugPost } from '../../src/play-feedback/domain/debug-intake.ts';
import type { Comment, Rating } from '../../src/play-feedback/domain/model.ts';
import { summarizeRatings } from '../../src/play-feedback/domain/rating-rules.ts';
import { planFlowBuild } from '../../src/playable-results/domain/build-requests.ts';
import type { Artifact, Build } from '../../src/playable-results/domain/model.ts';
import { variantResultStatus } from '../../src/playable-results/domain/result-status.ts';
import type { ProjectWorkspace } from '../../src/project-workspaces/domain/model.ts';
import { planWorkspace, type WorkspaceSettingsInput } from '../../src/project-workspaces/domain/workspace-rules.ts';

/**
 * Complements contracts.test.ts: every remaining predicate (C-2〜C-9, C-11, C-12) is evaluated
 * against the real rule, and against a fabricated violation so it cannot pass vacuously.
 */
const at = '2026-09-18T00:00:00.000Z';
const stamp = { id: 'new', at };
const COMMIT_A = 'aaaaaaa1';
const COMMIT_B = 'bbbbbbb2';
const variantFacts = { id: 'v1', projectCode: 'KD', tideId: 't1' };

function build(id: string, commit: string, state: Build['state'], requestedAt: string): Build {
  return { id, projectCode: 'KD', tideId: 't1', variantId: 'v1', commit, origin: 'variant-mainline-updated', dedupeKey: `cf-build:KD:v1:${commit}`, state, eventSeq: 0, requestedAt, updatedAt: requestedAt };
}

function artifact(id: string, b: Build): Artifact {
  return { id, projectCode: 'KD', buildId: b.id, tideId: 't1', variantId: 'v1', commit: b.commit, platform: 'web', delivery: 'download', uri: `https://example.invalid/${id}`, createdAt: at };
}

describe('contract predicates hold for the domain rules', () => {
  it('C-2 stale rule changes are rejected', () => {
    const rules = [{ key: 'turn-limit', text: '10' }];
    for (const changes of [[{ key: 'turn-limit', before: '12', after: '8' }], [{ key: 'turn-limit', before: '10', after: '8' }]]) {
      assert.equal(applyRuleChangesContract.post(applyRuleChanges(rules, changes), rules, changes), true);
    }
    const stale = [{ key: 'turn-limit', before: '12', after: '8' }];
    assert.equal(typeof applyRuleChangesContract.post({ ok: true, value: [{ key: 'turn-limit', text: '8' }] }, rules, stale), 'string');
  });

  it('C-3 branch and merge edges survive the projection', () => {
    const tides: Tide[] = [{ id: 't1', projectCode: 'KD', slug: 'rush', title: '速攻', concept: 'c', createdAt: at }];
    const base = { projectCode: 'KD', tideId: 't1', concept: 'c', rules: [], createdAt: at };
    const variants: Variant[] = [
      { ...base, id: 'v1', slug: 'a', title: 'A' },
      { ...base, id: 'v2', slug: 'b', title: 'B', branchedFrom: { variantId: 'v1', commit: COMMIT_A } },
    ];
    const input = { tides, variants, merges: [{ variantId: 'v2', integration: 'awaiting' as const }] };
    assert.equal(projectFlowGraphContract.post(projectFlowGraph(input), input), true);
    assert.equal(typeof projectFlowGraphContract.post({ nodes: [], edges: [] }, input), 'string');
  });

  it('C-4 AI summaries stay distinguishable from human comments', () => {
    const human: Comment = { id: 'c1', projectCode: 'KD', tideId: 't1', variantId: 'v1', author: { kind: 'human', name: '試遊者' }, body: '楽しい', source: 'cf-ui', createdAt: at };
    const humanDraft: CommentDraft = { projectCode: 'KD', variantId: 'v1', author: { kind: 'human', name: '試遊者' }, body: '楽しい', source: 'cf-ui' };
    const aiDraft: CommentDraft = { projectCode: 'KD', variantId: 'v1', author: { kind: 'ai-summary', agent: 'claude', sourceCommentIds: ['c1'] }, body: '要約', source: 'ai' };
    const ctx = { variant: variantFacts, sources: [human] };
    for (const draft of [humanDraft, aiDraft, { ...aiDraft, source: 'cf-ui' as const }, { ...humanDraft, source: 'ai' as const }]) {
      assert.equal(planCommentContract.post(planComment(ctx, draft, stamp), ctx, draft), true);
    }
    const unmarked = { ok: true as const, value: { ...human, id: 'c2', body: '要約' } };
    assert.equal(typeof planCommentContract.post(unmarked, ctx, aiDraft), 'string');
  });

  it('C-5 debug posts need open intake and keep the claimed build', () => {
    const claim = { projectCode: 'KD', variantId: 'v1', buildId: 'b1', commit: COMMIT_A };
    const buildFacts = { id: 'b1', projectCode: 'KD', variantId: 'v1', commit: COMMIT_A };
    for (const input of [
      { intakeOpen: false, variant: variantFacts, build: buildFacts, claim },
      { intakeOpen: true, variant: variantFacts, build: buildFacts, claim },
      { intakeOpen: true, variant: variantFacts, build: buildFacts, claim: { ...claim, commit: COMMIT_B } },
    ]) {
      assert.equal(admitDebugPostContract.post(admitDebugPost(input), input), true);
    }
    const closed = { intakeOpen: false, variant: variantFacts, build: buildFacts, claim };
    assert.equal(typeof admitDebugPostContract.post({ ok: true, value: { variant: variantFacts, playedBuild: { buildId: 'b1', commit: COMMIT_A } } }, closed), 'string');
  });

  it('C-6 only the current build is labelled current', () => {
    const scale = { min: 1, max: 5, items: [{ key: 'fun', label: '楽しさ' }] };
    const rating = (id: string, buildId: string, commit: string): Rating => ({ id, projectCode: 'KD', tideId: 't1', variantId: 'v1', playedBuild: { buildId, commit }, rater: 'p', scores: { fun: 4 }, scale, source: 'cf-ui', createdAt: at });
    const ratings = [rating('r1', 'b-old', COMMIT_A), rating('r2', 'b-new', COMMIT_B)];
    for (const current of ['b-new', 'b-old', undefined]) {
      assert.equal(summarizeRatingsContract.post(summarizeRatings(ratings, current), ratings, current), true);
    }
    const mislabelled = [{ buildId: 'b-old', commit: COMMIT_A, count: 1, averages: { fun: 4 }, isCurrent: true }];
    assert.equal(typeof summarizeRatingsContract.post(mislabelled, ratings, 'b-new'), 'string');
  });

  it('C-7 adoption needs a playable artifact of the chosen commit and a reason', () => {
    const variant = { id: 'v1', projectCode: 'KD', tideId: 't1' };
    const draft = { projectCode: 'KD', variantId: 'v1', verdict: 'adopted' as const, commit: COMMIT_A, reason: '軸に合う', decidedBy: 'dir', relatedCommentIds: [] };
    const cases = [
      { ctx: { variant }, draft },
      { ctx: { variant, evidence: { commit: COMMIT_B, buildId: 'b2', artifactIds: ['x'] } }, draft },
      { ctx: { variant, evidence: { commit: COMMIT_A, buildId: 'b1', artifactIds: ['x'] } }, draft },
      { ctx: { variant }, draft: { ...draft, verdict: 'declined' as const, reason: ' ' } },
    ];
    for (const c of cases) assert.equal(planDecisionContract.post(planDecision(c.ctx, c.draft, stamp), c.ctx, c.draft), true);
    const fabricated = planDecision({ variant, evidence: { commit: COMMIT_A, buildId: 'b1', artifactIds: ['x'] } }, draft, stamp);
    assert.ok(fabricated.ok);
    assert.equal(typeof planDecisionContract.post(fabricated, { variant }, draft), 'string');
  });

  it('C-8 integrated only from an adopted decision and a matching report', () => {
    const adopted: AdoptionDecision = { id: 'd1', projectCode: 'KD', tideId: 't1', variantId: 'v1', verdict: 'adopted', target: { commit: COMMIT_A, buildId: 'b1', artifactIds: ['x'] }, reason: 'r', decidedBy: 'dir', relatedCommentIds: [], integration: { state: 'awaiting' }, decidedAt: at };
    const declined: AdoptionDecision = { ...adopted, id: 'd2', verdict: 'declined', integration: { state: 'not_applicable' } };
    const report: IntegrationReport = { decisionId: 'd1', source: 'revisor', commit: COMMIT_A, outcome: 'integrated', ref: 'pr-1' };
    for (const [decision, r] of [[adopted, report], [adopted, { ...report, commit: COMMIT_B }], [declined, report], [adopted, { ...report, outcome: 'failed' as const }]] as const) {
      assert.equal(applyIntegrationReportContract.post(applyIntegrationReport(decision, r, at), decision, r), true);
    }
    const forged = { ok: true as const, value: { ...adopted, integration: { state: 'integrated' as const, source: 'revisor' as const, ref: 'pr-1', reportedAt: at } } };
    assert.equal(typeof applyIntegrationReportContract.post(forged, adopted, { ...report, commit: COMMIT_B }), 'string');
  });

  it('C-9 configuring Cf never changes the Cc-owned observation', () => {
    const input: WorkspaceSettingsInput = { projectCode: 'KD', name: 'Kuzu', ccProjectCode: 'KD', spawnDestinations: [], build: { triggers: ['variant-mainline-updated'], platforms: ['web'] }, deploy: { environments: [], managerRoles: [] }, debugIntake: true };
    const created = planWorkspace(undefined, input, at);
    assert.equal(planWorkspaceContract.post(created, undefined), true);
    assert.ok(created.ok);
    const existing: ProjectWorkspace = { ...created.value, flowObservation: { state: 'enabled', observedAt: at } };
    const renamed = { ...input, name: '新しい名前' };
    assert.equal(planWorkspaceContract.post(planWorkspace(existing, renamed, at), existing), true);
    assert.equal(typeof planWorkspaceContract.post({ ok: true, value: existing }, undefined), 'string');
    assert.equal(typeof planWorkspaceContract.post(created, existing), 'string');
  });

  it('C-11 playable and target labels only for the target commit', () => {
    const old = build('b1', COMMIT_A, 'succeeded', '2026-09-17T00:00:00.000Z');
    const failed = build('b2', COMMIT_B, 'failed', '2026-09-18T00:00:00.000Z');
    const artifacts = [artifact('a1', old)];
    for (const targetCommit of [COMMIT_B, COMMIT_A, undefined]) {
      const input = { variantId: 'v1', builds: [old, failed], artifacts, ...(targetCommit ? { targetCommit } : {}) };
      assert.equal(variantResultStatusContract.post(variantResultStatus(input), input), true);
    }
    const input = { variantId: 'v1', targetCommit: COMMIT_B, builds: [old, failed], artifacts };
    const borrowed = { targetCommit: COMMIT_B, target: 'playable' as const, targetBuild: old, targetArtifacts: artifacts };
    assert.equal(typeof variantResultStatusContract.post(borrowed, input), 'string');
  });

  it('C-12 repeated triggers return the existing build', () => {
    const settings = { triggers: ['variant-mainline-updated' as const], platforms: ['web'] };
    const target = { projectCode: 'KD', tideId: 't1', variantId: 'v1', commit: COMMIT_A };
    const first = planFlowBuild([], settings, target, 'variant-mainline-updated', stamp);
    assert.equal(planFlowBuildContract.post(first, []), true);
    assert.ok(first.ok);
    const existing = [first.value.build];
    const again = planFlowBuild(existing, settings, target, 'variant-mainline-updated', stamp);
    assert.equal(again.ok && again.value.action, 'existing');
    assert.equal(planFlowBuildContract.post(again, existing), true);
    assert.equal(typeof planFlowBuildContract.post(first, existing), 'string');
  });
});
