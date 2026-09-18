import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mainlineBranchName,
  parseFlowBranch,
  validateBranchNamingPolicy,
  workBranchName,
  type BranchNamingPolicy,
} from '../../src/evolution-streams/domain/branch-naming.ts';
import { validateSlug } from '../../src/evolution-streams/domain/slug.ts';

const suffix: BranchNamingPolicy = { evolutionPrefix: 'evolution', workPrefix: 'feature', mainline: 'suffix-main' };
const bare: BranchNamingPolicy = { ...suffix, mainline: 'variant-is-mainline' };

describe('branch naming is data, not a hard-coded convention', () => {
  it('suffix-main puts the mainline under /main', () => {
    assert.equal(mainlineBranchName(suffix, 'rush', 'combo'), 'evolution/rush/combo/main');
  });

  it('variant-is-mainline uses the variant ref itself', () => {
    assert.equal(mainlineBranchName(bare, 'rush', 'combo'), 'evolution/rush/combo');
  });

  it('work branches are feature/<tide>/<variant>/<task>', () => {
    const r = workBranchName(suffix, 'rush', 'combo', 'shorter-turns');
    assert.deepEqual(r, { ok: true, value: 'feature/rush/combo/shorter-turns' });
  });

  it('rejects task names that are not single ref segments', () => {
    assert.equal(workBranchName(suffix, 'rush', 'combo', 'a/b').ok, false);
  });

  it('parses mainline and work branches per policy', () => {
    assert.deepEqual(parseFlowBranch(suffix, 'evolution/rush/combo/main'), { kind: 'mainline', tide: 'rush', variant: 'combo' });
    assert.deepEqual(parseFlowBranch(suffix, 'evolution/rush/combo'), { kind: 'other' });
    assert.deepEqual(parseFlowBranch(bare, 'evolution/rush/combo'), { kind: 'mainline', tide: 'rush', variant: 'combo' });
    assert.deepEqual(parseFlowBranch(suffix, 'feature/rush/combo/x'), { kind: 'work', tide: 'rush', variant: 'combo', task: 'x' });
    assert.deepEqual(parseFlowBranch(suffix, 'main'), { kind: 'other' });
  });

  it('rejects identical prefixes and unknown mainline styles', () => {
    assert.equal(validateBranchNamingPolicy({ ...suffix, workPrefix: 'evolution' }).ok, false);
    assert.equal(validateBranchNamingPolicy({ ...suffix, mainline: 'other' as never }).ok, false);
  });

  it('reserves "main" and rejects ref-unsafe slugs', () => {
    assert.equal(validateSlug('亜流', 'main').ok, false);
    assert.equal(validateSlug('亜流', 'Upper').ok, false);
    assert.equal(validateSlug('亜流', 'ok-1').ok, true);
  });
});
