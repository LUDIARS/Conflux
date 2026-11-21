import assert from 'node:assert/strict';
import { it } from 'node:test';
import { assessAdoption, type TrialMetrics } from '../../src/adoption-decisions/domain/auto-adoption-rules.ts';
import { DEFAULT_AUTONOMOUS_ADOPTION } from '../../src/project-workspaces/domain/autonomous-adoption-policy.ts';

const policy = { ...DEFAULT_AUTONOMOUS_ADOPTION, enabled: true };
const threshold: TrialMetrics = {
  target: 'playable',
  measuredTrials: 5,
  ratingCount: 3,
  ratingScore: 0.75,
  criticalBugs: 0,
  failureRate: 0.2,
};

it('adopts at the inclusive rating, critical bug, and failure limits', () => {
  assert.equal(assessAdoption(policy, threshold).verdict, 'adopt');
  assert.equal(assessAdoption(policy, { ...threshold, measuredTrials: 3, failureRate: 0 }).verdict, 'adopt');
});

it('holds on disabled policy, unplayable builds, and insufficient evidence', () => {
  assert.equal(assessAdoption(DEFAULT_AUTONOMOUS_ADOPTION, threshold).verdict, 'hold');
  for (const target of ['failed', 'no_target', 'running', 'succeeded_without_artifact'] as const) {
    assert.equal(assessAdoption(policy, { ...threshold, target }).verdict, 'hold', target);
  }
  assert.equal(assessAdoption(policy, { ...threshold, measuredTrials: 2, failureRate: 1 }).verdict, 'hold');
  assert.equal(assessAdoption(policy, { ...threshold, ratingCount: 2 }).verdict, 'hold');
  assert.equal(assessAdoption(policy, { ...threshold, ratingScore: undefined }).verdict, 'hold');
});

it('rejects safety violations and ratings below the adoption threshold', () => {
  assert.equal(assessAdoption(policy, { ...threshold, measuredTrials: 1, criticalBugs: 1 }).verdict, 'reject');
  assert.equal(assessAdoption(policy, { ...threshold, failureRate: 0.21 }).verdict, 'reject');
  assert.equal(assessAdoption(policy, { ...threshold, ratingScore: 0.74 }).verdict, 'reject');
});
