import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import assessCheckoutContract from '../../contracts/assess-checkout.contract.ts';
import authorizeDeployContract from '../../contracts/authorize-deploy.contract.ts';
import nextSpawnActionContract from '../../contracts/next-spawn-action.contract.ts';
import planVariantContract from '../../contracts/plan-variant.contract.ts';
import { planVariant } from '../../src/evolution-streams/domain/flow-rules.ts';
import type { Tide, Variant } from '../../src/evolution-streams/domain/model.ts';
import { assessCheckout } from '../../src/flow-isolation/domain/selection.ts';
import type { ImplementationRequest } from '../../src/implementation-requests/domain/model.ts';
import { nextSpawnAction } from '../../src/implementation-requests/domain/request-rules.ts';
import { authorizeDeploy } from '../../src/playable-results/domain/deploy-authorization.ts';

/** The predicates themselves are tested against the real rules, so they cannot pass vacuously. */
describe('contract predicates hold for the rules', () => {
  const at = '2026-09-18T00:00:00.000Z';

  it('C-1 duplicate variants', () => {
    const tides: Tide[] = [{ id: 't', projectCode: 'KD', slug: 'a', title: 'a', concept: 'a', createdAt: at }];
    const variants: Variant[] = [{ id: 'v', projectCode: 'KD', tideId: 't', slug: 'b', title: 'b', concept: 'b', rules: [], createdAt: at }];
    const draft = { projectCode: 'KD', tideId: 't', slug: 'b', title: 'x', concept: 'y', rules: [] };
    const stamp = { id: 'v2', at };
    assert.equal(planVariantContract.post(planVariant(tides, variants, draft, stamp), tides, variants, draft), true);
    assert.equal(typeof planVariantContract.post({ ok: true, value: variants[0] as Variant }, tides, variants, draft), 'string');
  });

  it('C-10 uncertain requests are not resent', () => {
    for (const state of ['requested', 'unknown', 'pending', 'not_sent'] as const) {
      const request = { state } as ImplementationRequest;
      assert.equal(nextSpawnActionContract.post(nextSpawnAction(request), request), true);
    }
  });

  it('C-13 deploy authorisation', () => {
    const input = {
      settings: { environments: ['staging'], managerRoles: ['manager'] },
      identity: { status: 'verified' as const, actorId: 'u', roles: ['member'] },
      command: { projectCode: 'KD', artifactId: 'a', environment: 'staging', confirmArtifactId: 'a', confirmEnvironment: 'staging' },
    };
    assert.equal(authorizeDeployContract.post(authorizeDeploy(input), input), true);
  });

  it('C-14 dirty trees are never switched', () => {
    const policy = { evolutionPrefix: 'evolution', workPrefix: 'feature', mainline: 'suffix-main' as const };
    const selection = { projectCode: 'KD', tide: 'a', variant: 'b', baseBranch: 'evolution/a/b/main', workBranch: 'feature/a/b/t' };
    for (const branch of ['feature/x/y/z', 'evolution/a/b/main', 'main']) {
      const checkout = { branch, dirty: true };
      assert.equal(assessCheckoutContract.post(assessCheckout(policy, selection, checkout), policy, selection, checkout), true);
    }
  });
});
