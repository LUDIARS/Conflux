import { fail, ok, type Result } from '../../shared/result.ts';
import { bindPlayedBuild, type BuildFacts, type VariantFacts } from './comment-rules.ts';
import type { PlayedBuildRef } from './model.ts';

/** What a game's debug screen claims about the build it is running. */
export interface DebugBuildClaim {
  readonly projectCode: string;
  readonly variantId: string;
  readonly buildId: string;
  readonly commit: string;
}

/**
 * Admits a debug-screen post (CF-DEBUG-001). Games outside Cf Flow are refused, and the
 * claimed build must be a Cf-recorded build of the same variant and commit, so a post from
 * an old build is never attributed to a newer one.
 */
export function admitDebugPost(input: {
  readonly intakeOpen: boolean;
  readonly variant?: VariantFacts;
  readonly build?: BuildFacts;
  readonly claim: DebugBuildClaim;
}): Result<{ readonly variant: VariantFacts; readonly playedBuild: PlayedBuildRef }> {
  if (!input.intakeOpen) {
    return fail('conflux_flow_not_enabled', 'このプロジェクトは Cf Flow のデバッグ投稿が有効ではありません (Cc の conflux_flow 未有効または未接続)');
  }
  const variant = input.variant;
  if (!variant || variant.projectCode !== input.claim.projectCode || variant.id !== input.claim.variantId) {
    return fail('variant_not_found', '投稿元ビルドの亜流がこのプロジェクトにありません');
  }
  const bound = bindPlayedBuild(variant, input.build && input.build.id === input.claim.buildId ? input.build : undefined);
  if (!bound.ok) return bound;
  if (bound.value.commit !== input.claim.commit) {
    return fail('build_mismatch', '投稿元ビルドのコミットが Cf の記録と一致しません');
  }
  return ok({ variant, playedBuild: bound.value });
}
