import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { selectFlowForSession } from '../../src/flow-isolation/application/selection-use-cases.ts';
import { assessCheckout, buildFlowSelection } from '../../src/flow-isolation/domain/selection.ts';
import type { BranchNamingPolicy } from '../../src/evolution-streams/domain/branch-naming.ts';
import { testDeps } from '../support/fixtures.ts';
import { seedProject, unwrap } from '../support/seed.ts';

const policy: BranchNamingPolicy = { evolutionPrefix: 'evolution', workPrefix: 'feature', mainline: 'suffix-main' };

describe('flow selection', () => {
  const sel = buildFlowSelection(policy, { projectCode: 'KD', tide: 'rush', variant: 'combo', task: 'faster' });

  it('matches the Cc contract shape', () => {
    assert.deepEqual(sel, {
      ok: true,
      value: { projectCode: 'KD', tide: 'rush', variant: 'combo', baseBranch: 'evolution/rush/combo/main', workBranch: 'feature/rush/combo/faster' },
    });
  });

  it('detects another flow before work starts and never moves a dirty tree', () => {
    assert.ok(sel.ok);
    const clean = assessCheckout(policy, sel.value, { branch: 'feature/slow/guard/x', dirty: false });
    assert.equal(clean.verdict, 'other-flow');
    assert.equal(clean.canSwitch, true);
    const dirty = assessCheckout(policy, sel.value, { branch: 'feature/slow/guard/x', dirty: true });
    assert.equal(dirty.canSwitch, false);
    assert.equal(assessCheckout(policy, sel.value, { branch: 'feature/rush/combo/faster', dirty: true }).verdict, 'on-work-branch');
    assert.equal(assessCheckout(policy, sel.value, { branch: 'evolution/rush/combo/main', dirty: false }).verdict, 'on-base-branch');
  });
});

describe('select use case', () => {
  it('records an undeployed harness endpoint as not_connected, never selected', async () => {
    const { deps, gateways } = testDeps();
    const s = await seedProject(deps);
    const r = unwrap(await selectFlowForSession(deps, { projectCode: 'KD', variantId: s.variant.id, task: 'faster', sessionId: 'sess-1' }));
    assert.equal(r.state, 'not_connected');
    assert.equal(gateways.calls.select[0]?.selection.baseBranch, 'evolution/rush/combo/main');
  });

  it('refuses to select for a record saved before the naming was settled', async () => {
    const { deps, gateways } = testDeps();
    const s = await seedProject(deps);
    // Configuring a project now fills the naming in, so only an older record can still lack it.
    const { branchNaming: _omit, ...older } = s.workspace;
    await deps.workspaces.put(older);
    const r = await selectFlowForSession(deps, { projectCode: 'KD', variantId: s.variant.id, task: 'faster', sessionId: 'sess-1' });
    assert.equal(r.ok ? null : r.error.code, 'branch_naming_undecided');
    assert.equal(gateways.calls.select.length, 0);
  });
});
