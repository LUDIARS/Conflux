import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { observeFlowFlag } from '../../src/project-workspaces/domain/flow-observation.ts';
import { canIngestDebugFeedback, planWorkspace, requireBranchNaming } from '../../src/project-workspaces/domain/workspace-rules.ts';
import { workspaceInput } from '../support/fixtures.ts';

const now = '2026-09-18T00:00:00.000Z';

describe('workspace settings', () => {
  it('starts with an unknown Cf Flow observation, never enabled', () => {
    const r = planWorkspace(undefined, workspaceInput(), now);
    assert.equal(r.ok && r.value.flowObservation.state, 'unknown');
  });

  it('reconfiguring keeps the Cc-owned observation untouched', () => {
    const first = planWorkspace(undefined, workspaceInput(), now);
    assert.ok(first.ok);
    const observed = { ...first.value, flowObservation: { state: 'disabled' as const, observedAt: now } };
    const again = planWorkspace(observed, workspaceInput({ debugIntake: false }), now);
    assert.equal(again.ok && again.value.flowObservation.state, 'disabled');
  });

  it('requires the address keys Cc needs per destination kind', () => {
    const r = planWorkspace(undefined, workspaceInput({ spawnDestinations: [{ id: 's', kind: 'slack', label: 'S', address: { channelId: 'c' } }] }), now);
    assert.equal(r.ok ? null : r.error.code, 'invalid_destination');
  });

  it('rejects an inverted rating scale', () => {
    const r = planWorkspace(undefined, workspaceInput({ ratingScale: { min: 5, max: 1, items: [{ key: 'a', label: 'a' }] } }), now);
    assert.equal(r.ok, false);
  });

  it('reports undecided branch naming instead of defaulting', () => {
    const { branchNaming: _omit, ...rest } = workspaceInput();
    const r = planWorkspace(undefined, rest, now);
    assert.ok(r.ok);
    assert.equal(requireBranchNaming(r.value).ok, false);
  });
});

describe('Cf Flow observation from Cc', () => {
  it('only a literal true is enabled', () => {
    assert.equal(observeFlowFlag({ kind: 'found', hasConfluxFlowField: true, confluxFlow: true }, now).state, 'enabled');
    assert.equal(observeFlowFlag({ kind: 'found', hasConfluxFlowField: true, confluxFlow: false }, now).state, 'disabled');
    assert.equal(observeFlowFlag({ kind: 'found', hasConfluxFlowField: true, confluxFlow: 'true' }, now).state, 'unknown');
  });

  it('a registry without the field is the undeployed Cc: not connected', () => {
    assert.equal(observeFlowFlag({ kind: 'found', hasConfluxFlowField: false, confluxFlow: undefined }, now).state, 'not_connected');
  });

  it('debug intake requires both the opt-in and an enabled observation', () => {
    const r = planWorkspace(undefined, workspaceInput({ debugIntake: true }), now);
    assert.ok(r.ok);
    assert.equal(canIngestDebugFeedback(r.value), false);
    assert.equal(canIngestDebugFeedback({ ...r.value, flowObservation: { state: 'enabled', observedAt: now } }), true);
    assert.equal(canIngestDebugFeedback({ ...r.value, debugIntake: false, flowObservation: { state: 'enabled', observedAt: now } }), false);
  });
});
