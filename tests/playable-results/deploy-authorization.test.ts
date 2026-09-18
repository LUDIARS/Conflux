import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyDeployOutcome, authorizeDeploy, newDeployment } from '../../src/playable-results/domain/deploy-authorization.ts';
import type { Artifact, Build } from '../../src/playable-results/domain/model.ts';

const at = '2026-09-18T00:00:00.000Z';
const settings = { environments: ['staging'], managerRoles: ['manager'] };
const build: Build = { id: 'b1', projectCode: 'KD', tideId: 't1', variantId: 'v1', commit: 'aaa1111', origin: 'hook-reported', dedupeKey: 'k', state: 'succeeded', eventSeq: 1, requestedAt: at, updatedAt: at };
const artifact: Artifact = { id: 'a1', projectCode: 'KD', buildId: 'b1', tideId: 't1', variantId: 'v1', commit: 'aaa1111', platform: 'web', delivery: 'deployable', uri: 'https://x', createdAt: at };
const command = { projectCode: 'KD', artifactId: 'a1', environment: 'staging', confirmArtifactId: 'a1', confirmEnvironment: 'staging' };
const manager = { status: 'verified' as const, actorId: 'u1', roles: ['manager'] };

describe('deploy authorization', () => {
  it('denies below manager', () => {
    const r = authorizeDeploy({ settings, identity: { status: 'verified', actorId: 'u2', roles: ['member'] }, command, artifact, build });
    assert.equal(r.ok ? null : r.error.code, 'forbidden');
  });

  it('denies when Cc cannot verify the caller or the role mapping is undecided', () => {
    assert.equal(authorizeDeploy({ settings, identity: { status: 'unavailable', reason: 'x' }, command, artifact, build }).ok, false);
    const r = authorizeDeploy({ settings: { ...settings, managerRoles: [] }, identity: manager, command, artifact, build });
    assert.equal(r.ok ? null : r.error.code, 'role_mapping_undecided');
  });

  it('requires the confirmed artifact/environment and a deployable artifact of a succeeded build', () => {
    assert.equal(authorizeDeploy({ settings, identity: manager, command: { ...command, confirmEnvironment: 'prod' }, artifact, build }).ok, false);
    assert.equal(authorizeDeploy({ settings, identity: manager, command, artifact: { ...artifact, delivery: 'download' }, build }).ok, false);
    assert.equal(authorizeDeploy({ settings, identity: manager, command, artifact, build: { ...build, state: 'failed' } }).ok, false);
    assert.equal(authorizeDeploy({ settings, identity: manager, command: { ...command, environment: 'prod', confirmEnvironment: 'prod' }, artifact, build }).ok, false);
  });

  it('allows a manager and never turns unknown into success', () => {
    const r = authorizeDeploy({ settings, identity: manager, command, artifact, build });
    assert.ok(r.ok);
    const d = newDeployment(r.value, { id: 'd1', at });
    assert.equal(applyDeployOutcome(d, { kind: 'unknown', reason: 'timeout' }, at).state, 'unknown');
    assert.equal(applyDeployOutcome(d, { kind: 'not_connected', reason: 'x' }, at).state, 'not_connected');
  });
});
