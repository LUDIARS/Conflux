import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { configureWorkspace, refreshFlowObservation } from '../../src/project-workspaces/application/workspace-use-cases.ts';
import { testDeps, workspaceInput } from '../support/fixtures.ts';
import { unwrap } from '../support/seed.ts';

describe('workspace use cases', () => {
  it('stores what Cc reported and never claims enabled when Cc is unreachable', async () => {
    const { deps, gateways } = testDeps();
    unwrap(await configureWorkspace(deps, workspaceInput()));
    gateways.registryResult = { kind: 'not_connected', reason: 'ECONNREFUSED' };
    assert.equal(unwrap(await refreshFlowObservation(deps, 'KD')).flowObservation.state, 'not_connected');
    gateways.registryResult = { kind: 'found', hasConfluxFlowField: true, confluxFlow: true };
    assert.equal(unwrap(await refreshFlowObservation(deps, 'KD')).flowObservation.state, 'enabled');
  });

  it('keeps KD and Mp settings separate', async () => {
    const { deps } = testDeps();
    unwrap(await configureWorkspace(deps, workspaceInput()));
    unwrap(await configureWorkspace(deps, workspaceInput({ projectCode: 'Mp', name: 'Second Project', ccProjectCode: 'Mp', spawnDestinations: [] })));
    assert.equal((await deps.workspaces.get('KD'))?.spawnDestinations.length, 1);
    assert.equal((await deps.workspaces.get('Mp'))?.spawnDestinations.length, 0);
  });
});
