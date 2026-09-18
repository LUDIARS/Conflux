import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decideAdoption, recordIntegration } from '../../src/adoption-decisions/application/decision-use-cases.ts';
import { describeIntegration, officialLineage } from '../../src/adoption-decisions/domain/decision-rules.ts';
import { loadProjectOverview } from '../../src/evolution-streams/application/project-overview.ts';
import { COMMIT_A, COMMIT_B, testDeps } from '../support/fixtures.ts';
import { seedPlayableBuild, seedProject, unwrap } from '../support/seed.ts';

describe('adoption decisions (合流)', () => {
  it('adopting requires a playable artifact of exactly that version', async () => {
    const { deps } = testDeps();
    const s = await seedProject(deps);
    await seedPlayableBuild(deps, s, COMMIT_A);
    const none = await decideAdoption(deps, { projectCode: 'KD', variantId: s.variant.id, verdict: 'adopted', commit: COMMIT_B, reason: 'r', decidedBy: 'dir', relatedCommentIds: [] });
    assert.equal(none.ok ? null : none.error.code, 'no_playable_artifact');
    const ok = unwrap(await decideAdoption(deps, { projectCode: 'KD', variantId: s.variant.id, verdict: 'adopted', commit: COMMIT_A, reason: '軸に合う', decidedBy: 'dir', relatedCommentIds: [] }));
    assert.equal(ok.target.commit, COMMIT_A);
    assert.equal(ok.target.artifactIds.length, 2);
  });

  it('adopted is shown as not integrated until Cc/Rv/GitHub report it', async () => {
    const { deps } = testDeps();
    const s = await seedProject(deps);
    await seedPlayableBuild(deps, s, COMMIT_A);
    const d = unwrap(await decideAdoption(deps, { projectCode: 'KD', variantId: s.variant.id, verdict: 'adopted', commit: COMMIT_A, reason: 'r', decidedBy: 'dir', relatedCommentIds: [] }));
    assert.equal(d.integration.state, 'awaiting');
    assert.match(describeIntegration(d.integration), /未統合/);
    const wrong = await recordIntegration(deps, { projectCode: 'KD', decisionId: d.id, source: 'revisor', commit: COMMIT_B, outcome: 'integrated', ref: 'pr-1' });
    assert.equal(wrong.ok, false);
    const done = unwrap(await recordIntegration(deps, { projectCode: 'KD', decisionId: d.id, source: 'revisor', commit: COMMIT_A, outcome: 'integrated', ref: 'pr-1' }));
    assert.equal(done.integration.state, 'integrated');
    const o = unwrap(await loadProjectOverview(deps, 'KD'));
    assert.ok(o.graph.edges.some((e) => e.kind === 'merged' && e.integration === 'integrated'));
  });

  it('declines keep their reason and do not enter the official lineage', async () => {
    const { deps } = testDeps();
    const s = await seedProject(deps);
    const d = unwrap(await decideAdoption(deps, { projectCode: 'KD', variantId: s.variant.id, verdict: 'declined', reason: '冗長', decidedBy: 'dir', relatedCommentIds: [] }));
    assert.equal(d.reason, '冗長');
    assert.equal(officialLineage([d]).length, 0);
    const empty = await decideAdoption(deps, { projectCode: 'KD', variantId: s.variant.id, verdict: 'declined', reason: ' ', decidedBy: 'dir', relatedCommentIds: [] });
    assert.equal(empty.ok, false);
  });
});
