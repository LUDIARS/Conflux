import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { recordRevision } from '../../src/evolution-streams/application/flow-use-cases.ts';
import { ingestBuildEvent, requestFlowBuild, retryBuild } from '../../src/playable-results/application/build-use-cases.ts';
import { deployArtifact } from '../../src/playable-results/application/deploy-use-cases.ts';
import { onRevisionRecorded } from '../../src/playable-results/application/flow-trigger.ts';
import { COMMIT_A, testDeps } from '../support/fixtures.ts';
import { seedPlayableBuild, seedProject, unwrap } from '../support/seed.ts';

describe('build use cases', () => {
  it('a mainline revision asks Cc to build its commit once, even if hooks repeat', async () => {
    const { deps, gateways } = testDeps();
    const s = await seedProject(deps);
    gateways.buildOutcome = { kind: 'accepted', value: { accepted: true } };
    const rev = unwrap(await recordRevision(deps, { projectCode: 'KD', variantId: s.variant.id, intent: 'i', summary: '', ruleChanges: [], gitRef: { branch: 'evolution/rush/combo/main', commit: COMMIT_A } }));
    const first = unwrap(await onRevisionRecorded(deps, rev));
    assert.equal(first.kind, 'requested');
    unwrap(await requestFlowBuild(deps, { projectCode: 'KD', variantId: s.variant.id, commit: COMMIT_A, origin: 'variant-mainline-updated' }));
    assert.equal(gateways.calls.build.length, 1);
    assert.equal(gateways.calls.build[0]?.branch, 'evolution/rush/combo/main');
  });

  it('a revision on a work branch does not trigger a mainline build', async () => {
    const { deps, gateways } = testDeps();
    const s = await seedProject(deps);
    const rev = unwrap(await recordRevision(deps, { projectCode: 'KD', variantId: s.variant.id, intent: 'i', summary: '', ruleChanges: [], gitRef: { branch: 'feature/rush/combo/x', commit: COMMIT_A } }));
    assert.equal(unwrap(await onRevisionRecorded(deps, rev)).kind, 'skipped');
    assert.equal(gateways.calls.build.length, 0);
  });

  it('shows an undeployed build route as not_connected and allows an explicit retry', async () => {
    const { deps, gateways } = testDeps();
    const s = await seedProject(deps);
    const b = unwrap(await requestFlowBuild(deps, { projectCode: 'KD', variantId: s.variant.id, commit: COMMIT_A, origin: 'variant-mainline-updated' }));
    assert.equal(b.state, 'not_connected');
    const retry = unwrap(await retryBuild(deps, { projectCode: 'KD', buildId: b.id }));
    assert.equal(retry.retryOf, b.id);
    assert.equal(gateways.calls.build.length, 2);
  });

  it('hook events for a build of another project are refused', async () => {
    const { deps } = testDeps();
    const s = await seedProject(deps);
    const r = await ingestBuildEvent(deps, { dedupeKey: 'x', projectCode: 'Mp', variantId: s.variant.id, commit: COMMIT_A, seq: 1, state: 'running' });
    assert.equal(r.ok, false);
  });
});

describe('deploy use case', () => {
  it('checks the caller with Cc on every API call and records not_connected targets honestly', async () => {
    const { deps, gateways } = testDeps();
    const s = await seedProject(deps);
    await seedPlayableBuild(deps, s, COMMIT_A);
    const deployable = (await deps.artifacts.listByProject('KD')).find((a) => a.delivery === 'deployable');
    assert.ok(deployable);
    const command = { projectCode: 'KD', artifactId: deployable.id, environment: 'staging', confirmArtifactId: deployable.id, confirmEnvironment: 'staging' };

    const unavailable = await deployArtifact(deps, command, 'token');
    assert.equal(unavailable.ok ? null : unavailable.error.code, 'identity_unavailable');

    gateways.identityResult = { status: 'verified', actorId: 'u2', roles: ['member'] };
    const member = await deployArtifact(deps, command, 'token');
    assert.equal(member.ok ? null : member.error.code, 'forbidden');
    assert.equal(gateways.calls.deploy.length, 0);

    gateways.identityResult = { status: 'verified', actorId: 'u1', roles: ['director'] };
    const d = unwrap(await deployArtifact(deps, command, 'token'));
    assert.equal(d.state, 'not_connected');
    assert.equal(gateways.calls.identityTokens.length, 3);
  });
});
