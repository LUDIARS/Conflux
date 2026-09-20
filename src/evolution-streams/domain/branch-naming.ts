import { fail, ok, type Result } from '../../shared/result.ts';
import { validateSlug } from './slug.ts';

/**
 * How a variant's mainline is spelled in git (CF-DESIGN-001):
 * - 'suffix-main':          mainline = evolution/<tide>/<variant>/main
 * - 'variant-is-mainline':  mainline = evolution/<tide>/<variant> (shown as "main" in UI)
 * Git cannot hold both evolution/x/y and evolution/x/y/main, so this stays a per-project setting.
 * Settled on 2026-09-20 as 'suffix-main': naming the variant itself the mainline would close the
 * namespace beneath it for good, and nothing is gained by spending it.
 */
export type MainlineNaming = 'suffix-main' | 'variant-is-mainline';

export interface BranchNamingPolicy {
  readonly evolutionPrefix: string;
  readonly workPrefix: string;
  readonly mainline: MainlineNaming;
}

export type ParsedFlowBranch =
  | { readonly kind: 'mainline'; readonly tide: string; readonly variant: string }
  | { readonly kind: 'work'; readonly tide: string; readonly variant: string; readonly task: string }
  | { readonly kind: 'other' };

const PREFIX_PATTERN = /^[a-z][a-z0-9-]{0,30}$/;

export function validateBranchNamingPolicy(policy: BranchNamingPolicy): Result<BranchNamingPolicy> {
  if (!PREFIX_PATTERN.test(policy.evolutionPrefix) || !PREFIX_PATTERN.test(policy.workPrefix)) {
    return fail('invalid_branch_prefix', 'ブランチ接頭辞は英小文字で始まる英小文字・数字・ハイフンで指定してください');
  }
  if (policy.evolutionPrefix === policy.workPrefix) {
    return fail('invalid_branch_prefix', '本流と作業ブランチの接頭辞は別にしてください');
  }
  if (policy.mainline !== 'suffix-main' && policy.mainline !== 'variant-is-mainline') {
    return fail('invalid_mainline_naming', '本流の命名方式は suffix-main か variant-is-mainline を指定してください');
  }
  return ok(policy);
}

export function mainlineBranchName(policy: BranchNamingPolicy, tide: string, variant: string): string {
  const base = `${policy.evolutionPrefix}/${tide}/${variant}`;
  return policy.mainline === 'suffix-main' ? `${base}/main` : base;
}

export function workBranchName(policy: BranchNamingPolicy, tide: string, variant: string, task: string): Result<string> {
  const checked = validateSlug('作業名', task);
  if (!checked.ok) return checked;
  return ok(`${policy.workPrefix}/${tide}/${variant}/${task}`);
}

export function parseFlowBranch(policy: BranchNamingPolicy, branch: string): ParsedFlowBranch {
  const parts = branch.split('/');
  if (parts[0] === policy.evolutionPrefix) {
    const suffixMain = policy.mainline === 'suffix-main' && parts.length === 4 && parts[3] === 'main';
    const bare = policy.mainline === 'variant-is-mainline' && parts.length === 3;
    if ((suffixMain || bare) && parts[1] && parts[2]) {
      return { kind: 'mainline', tide: parts[1], variant: parts[2] };
    }
    return { kind: 'other' };
  }
  if (parts[0] === policy.workPrefix && parts.length === 4 && parts[1] && parts[2] && parts[3]) {
    return { kind: 'work', tide: parts[1], variant: parts[2], task: parts[3] };
  }
  return { kind: 'other' };
}
