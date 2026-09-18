import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createTide, recordRevision } from '../../src/evolution-streams/application/flow-use-cases.ts';
import { loadProjectOverview } from '../../src/evolution-streams/application/project-overview.ts';
import { COMMIT_A, testDeps } from '../support/fixtures.ts';
import { seedPlayableBuild, seedProject, unwrap } from '../support/seed.ts';

describe('flow use cases', () => {
  it('refuses flows for a project that is not registered in Cf', async () => {
    const { deps } = testDeps();
    const r = await createTide(deps, { projectCode: 'Mp', slug: 'a', title: 'x', concept: 'y' });
    assert.equal(r.ok ? null : r.error.code, 'project_not_found');
  });

  it('keeps KD and Mp flows separate', async () => {
    const { deps } = testDeps();
    const kd = await seedProject(deps);
    await seedProject(deps, { settings: { projectCode: 'Mp', name: 'Second Project', ccProjectCode: 'Mp' } });
    const r = await recordRevision(deps, { projectCode: 'Mp', variantId: kd.variant.id, intent: 'x', summary: '', ruleChanges: [], gitRef: { branch: 'b' } });
    assert.equal(r.ok ? null : r.error.code, 'variant_not_found');
    const kdOverview = unwrap(await loadProjectOverview(deps, 'KD'));
    assert.equal(kdOverview.variants.length, 1);
  });

  it('overview detail matches the selected graph node', async () => {
    const { deps } = testDeps();
    const s = await seedProject(deps);
    unwrap(await recordRevision(deps, { projectCode: 'KD', variantId: s.variant.id, intent: 'faster', summary: '', ruleChanges: [], gitRef: { branch: 'evolution/rush/combo/main', commit: COMMIT_A } }));
    await seedPlayableBuild(deps, s, COMMIT_A);
    const o = unwrap(await loadProjectOverview(deps, 'KD', s.variant.id));
    assert.equal(o.selected?.variant.id, s.variant.id);
    assert.equal(o.selected?.result.target, 'playable');
    assert.ok(o.graph.nodes.some((n) => n.id === s.variant.id));
  });
});
