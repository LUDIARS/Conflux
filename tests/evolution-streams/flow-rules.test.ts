import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyRuleChanges, planRevision, planTide, planVariant, targetCommitOf } from '../../src/evolution-streams/domain/flow-rules.ts';
import type { Revision, Tide, Variant } from '../../src/evolution-streams/domain/model.ts';
import { compareVariants } from '../../src/evolution-streams/domain/variant-comparison.ts';

const at = '2026-09-18T00:00:00.000Z';
const tide: Tide = { id: 't1', projectCode: 'KD', slug: 'rush', title: '速攻', concept: 'c', createdAt: at };
const variant: Variant = {
  id: 'v1',
  projectCode: 'KD',
  tideId: 't1',
  slug: 'combo',
  title: 'コンボ',
  concept: 'c',
  rules: [{ key: 'turn-limit', text: '10' }],
  createdAt: at,
};

describe('tides and variants', () => {
  it('distinguishes multiple tides and variants in one project but rejects duplicates', () => {
    assert.equal(planTide([tide], { projectCode: 'KD', slug: 'rush', title: 'x', concept: 'y' }, { id: 't2', at }).ok, false);
    assert.equal(planTide([tide], { projectCode: 'KD', slug: 'slow', title: 'x', concept: 'y' }, { id: 't2', at }).ok, true);
    const draft = { projectCode: 'KD', tideId: 't1', slug: 'combo', title: 'x', concept: 'y', rules: [] };
    assert.equal(planVariant([tide], [variant], draft, { id: 'v2', at }).ok, false);
    assert.equal(planVariant([tide], [variant], { ...draft, slug: 'solo' }, { id: 'v2', at }).ok, true);
  });

  it('refuses a tide of another project', () => {
    const r = planVariant([tide], [], { projectCode: 'Mp', tideId: 't1', slug: 'a', title: 'x', concept: 'y', rules: [] }, { id: 'v', at });
    assert.equal(r.ok, false);
  });

  it('refuses a branch parent from another project', () => {
    const foreign = { ...variant, id: 'vx', projectCode: 'Mp' };
    const r = planVariant([tide], [foreign], { projectCode: 'KD', tideId: 't1', slug: 'b', title: 'x', concept: 'y', rules: [], branchedFrom: { variantId: 'vx' } }, { id: 'v', at });
    assert.deepEqual(r.ok ? null : r.error.code, 'parent_not_found');
  });
});

describe('revisions', () => {
  it('applies changes only when before matches the variant', () => {
    assert.equal(applyRuleChanges(variant.rules, [{ key: 'turn-limit', before: '12', after: '8' }]).ok, false);
    const ok = applyRuleChanges(variant.rules, [
      { key: 'turn-limit', before: '10', after: '8' },
      { key: 'bonus', after: '+1' },
    ]);
    assert.deepEqual(ok.ok && ok.value, [
      { key: 'turn-limit', text: '8' },
      { key: 'bonus', text: '+1' },
    ]);
  });

  it('removes a rule when after is absent', () => {
    const r = applyRuleChanges(variant.rules, [{ key: 'turn-limit', before: '10' }]);
    assert.deepEqual(r.ok && r.value, []);
  });

  it('does not record a revision against another variant', () => {
    const r = planRevision(variant, { projectCode: 'KD', variantId: 'other', intent: 'i', summary: '', ruleChanges: [], gitRef: { branch: 'b' } }, { id: 'r', at });
    assert.equal(r.ok, false);
  });

  it('target commit is the latest recorded commit of the variant', () => {
    const rev = (id: string, variantId: string, createdAt: string, commit?: string): Revision => ({
      id,
      projectCode: 'KD',
      tideId: 't1',
      variantId,
      intent: 'i',
      summary: '',
      ruleChanges: [],
      gitRef: commit ? { branch: 'b', commit } : { branch: 'b' },
      createdAt,
    });
    const revisions = [rev('1', 'v1', '2026-01-01', 'aaa1111'), rev('2', 'v1', '2026-01-02', 'bbb2222'), rev('3', 'v1', '2026-01-03'), rev('4', 'v2', '2026-01-04', 'ccc3333')];
    assert.equal(targetCommitOf(revisions, 'v1'), 'bbb2222');
  });
});

describe('comparison', () => {
  it('shows concept and per-rule differences', () => {
    const other: Variant = { ...variant, id: 'v2', title: 'ソロ', concept: 'd', rules: [{ key: 'turn-limit', text: '6' }, { key: 'solo', text: 'yes' }] };
    const c = compareVariants(variant, other);
    assert.deepEqual(
      c.rules.map((r) => [r.key, r.state]),
      [
        ['solo', 'only-right'],
        ['turn-limit', 'differs'],
      ],
    );
    assert.equal(c.right.concept, 'd');
  });
});
