import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { recordRevision } from '../../src/evolution-streams/application/flow-use-cases.ts';
import { loadProjectOverview } from '../../src/evolution-streams/application/project-overview.ts';
import { ingestDebugFeedback, postComment, rateVariant } from '../../src/play-feedback/application/feedback-use-cases.ts';
import { COMMIT_A, COMMIT_B, testDeps } from '../support/fixtures.ts';
import { seedPlayableBuild, seedProject, unwrap } from '../support/seed.ts';

describe('feedback use cases', () => {
  it('debug-screen posts land in the same flow as Cf UI comments', async () => {
    const { deps } = testDeps();
    const s = await seedProject(deps, { flowEnabled: true });
    const build = await seedPlayableBuild(deps, s, COMMIT_A);
    unwrap(await postComment(deps, { projectCode: 'KD', variantId: s.variant.id, author: { kind: 'human', name: 'dir' }, body: 'UI から', source: 'cf-ui' }));
    const posted = unwrap(
      await ingestDebugFeedback(deps, {
        claim: { projectCode: 'KD', variantId: s.variant.id, buildId: build.id, commit: COMMIT_A },
        player: 'tester',
        body: '速すぎる',
        scores: { fun: 4, fit: 3 },
      }),
    );
    assert.equal(posted.comment?.source, 'debug-screen');
    assert.equal(posted.rating?.playedBuild.buildId, build.id);
    const o = unwrap(await loadProjectOverview(deps, 'KD', s.variant.id));
    assert.equal(o.selected?.threads.length, 2);
  });

  it('refuses debug posts while Cc has not enabled Cf Flow', async () => {
    const { deps } = testDeps();
    const s = await seedProject(deps);
    const build = await seedPlayableBuild(deps, s, COMMIT_A);
    const r = await ingestDebugFeedback(deps, { claim: { projectCode: 'KD', variantId: s.variant.id, buildId: build.id, commit: COMMIT_A }, player: 'p', body: 'x' });
    assert.equal(r.ok ? null : r.error.code, 'conflux_flow_not_enabled');
    assert.equal((await deps.comments.listByProject('KD')).length, 0);
  });

  it('stores nothing when half of a debug post is invalid', async () => {
    const { deps } = testDeps();
    const s = await seedProject(deps, { flowEnabled: true });
    const build = await seedPlayableBuild(deps, s, COMMIT_A);
    const r = await ingestDebugFeedback(deps, { claim: { projectCode: 'KD', variantId: s.variant.id, buildId: build.id, commit: COMMIT_A }, player: 'p', body: 'ok', scores: { fun: 99, fit: 1 } });
    assert.equal(r.ok, false);
    assert.equal((await deps.comments.listByProject('KD')).length, 0);
  });

  it('ratings of the older build stay marked as past after a newer target build', async () => {
    const { deps } = testDeps();
    const s = await seedProject(deps);
    const old = await seedPlayableBuild(deps, s, COMMIT_A);
    unwrap(await rateVariant(deps, { projectCode: 'KD', variantId: s.variant.id, playedBuildId: old.id, rater: 'p', scores: { fun: 5, fit: 5 } }));
    unwrap(await recordRevision(deps, { projectCode: 'KD', variantId: s.variant.id, intent: 'next', summary: '', ruleChanges: [], gitRef: { branch: 'evolution/rush/combo/main', commit: COMMIT_B } }));
    await seedPlayableBuild(deps, s, COMMIT_B);
    const o = unwrap(await loadProjectOverview(deps, 'KD', s.variant.id));
    assert.equal(o.selected?.ratings[0]?.buildId, old.id);
    assert.equal(o.selected?.ratings[0]?.isCurrent, false);
  });
});
