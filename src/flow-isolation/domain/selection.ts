import {
  mainlineBranchName,
  parseFlowBranch,
  workBranchName,
  type BranchNamingPolicy,
} from '../../evolution-streams/domain/branch-naming.ts';
import { ok, type Result } from '../../shared/result.ts';

/**
 * The selection handed to Cc: `POST /v1/harness/conflux/select`
 * `{ session_id, selection: { projectCode, tide, variant, baseBranch, workBranch } }`.
 * baseBranch is the variant's mainline under the project's explicit naming policy.
 */
export interface FlowSelection {
  readonly projectCode: string;
  readonly tide: string;
  readonly variant: string;
  readonly baseBranch: string;
  readonly workBranch: string;
}

export function buildFlowSelection(
  policy: BranchNamingPolicy,
  input: { readonly projectCode: string; readonly tide: string; readonly variant: string; readonly task: string },
): Result<FlowSelection> {
  const work = workBranchName(policy, input.tide, input.variant, input.task);
  if (!work.ok) return work;
  return ok({
    projectCode: input.projectCode,
    tide: input.tide,
    variant: input.variant,
    baseBranch: mainlineBranchName(policy, input.tide, input.variant),
    workBranch: work.value,
  });
}

export type CheckoutVerdict = 'on-work-branch' | 'on-base-branch' | 'other-flow' | 'outside-flow';

export interface CheckoutAssessment {
  readonly verdict: CheckoutVerdict;
  /** True only when moving is safe: no uncommitted changes would be carried into another flow. */
  readonly canSwitch: boolean;
  readonly message: string;
}

/**
 * Cf-side pre-check of a checkout against the selected flow (CF-HARNESS-001). The actual
 * warning/switch is performed by the Cc hook; this mirrors its decision for display so a
 * user sees a mismatch before asking Cc to start work. Dirty trees are never moved.
 */
export function assessCheckout(
  policy: BranchNamingPolicy,
  selection: FlowSelection,
  checkout: { readonly branch: string; readonly dirty: boolean },
): CheckoutAssessment {
  if (checkout.branch === selection.workBranch) {
    return { verdict: 'on-work-branch', canSwitch: false, message: '選択した流れの作業ブランチ上にいます' };
  }
  const parsed = parseFlowBranch(policy, checkout.branch);
  const sameFlow = parsed.kind !== 'other' && parsed.tide === selection.tide && parsed.variant === selection.variant;
  if (checkout.branch === selection.baseBranch || (sameFlow && parsed.kind === 'mainline')) {
    return {
      verdict: 'on-base-branch',
      canSwitch: !checkout.dirty,
      message: checkout.dirty
        ? '本流ブランチに未コミット変更があります。作業ブランチへ移る前に保存状態を確認してください'
        : '本流ブランチ上です。作業ブランチへ切り替えます',
    };
  }
  if (parsed.kind !== 'other') {
    return {
      verdict: 'other-flow',
      canSwitch: !checkout.dirty,
      message: checkout.dirty
        ? `別の流れ (${parsed.tide}/${parsed.variant}) に未コミット変更があります。別潮流へ持ち越さないため切り替えません`
        : `別の流れ (${parsed.tide}/${parsed.variant}) にいます。選択した流れの作業ブランチへ切り替えます`,
    };
  }
  return {
    verdict: 'outside-flow',
    canSwitch: !checkout.dirty,
    message: checkout.dirty
      ? '流れ外のブランチに未コミット変更があります。切り替えずに保存状態を保ちます'
      : '流れ外のブランチです。選択した流れの作業ブランチへ切り替えます',
  };
}
