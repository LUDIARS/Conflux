import { mainlineBranchName } from '../../evolution-streams/domain/branch-naming.ts';
import type { Revision } from '../../evolution-streams/domain/model.ts';
import { ok, type Result } from '../../shared/result.ts';
import type { Build } from '../domain/model.ts';
import { requestFlowBuild, type BuildDeps } from './build-use-cases.ts';

export type TriggerDecision =
  | { readonly kind: 'requested'; readonly build: Build }
  | { readonly kind: 'skipped'; readonly reason: string };

/**
 * Flow-linked build trigger (CF-BUILD-001): a revision recorded on the variant's mainline
 * with a commit asks Cc to build that commit, when the project configured this trigger.
 */
export async function onRevisionRecorded(deps: BuildDeps, revision: Revision): Promise<Result<TriggerDecision>> {
  const commit = revision.gitRef.commit;
  if (!commit) return ok({ kind: 'skipped', reason: 'コミット未記録' });
  const ws = await deps.workspaces.get(revision.projectCode);
  if (!ws || !ws.build.triggers.includes('variant-mainline-updated')) {
    return ok({ kind: 'skipped', reason: '本流更新のビルド契機が未設定' });
  }
  if (!ws.branchNaming) return ok({ kind: 'skipped', reason: '本流ブランチの命名が未設定' });
  const [tide, variant] = await Promise.all([deps.tides.get(revision.tideId), deps.variants.get(revision.variantId)]);
  if (!tide || !variant) return ok({ kind: 'skipped', reason: '潮流/亜流が見つからない' });
  if (revision.gitRef.branch !== mainlineBranchName(ws.branchNaming, tide.slug, variant.slug)) {
    return ok({ kind: 'skipped', reason: '本流以外のブランチの改修' });
  }
  const build = await requestFlowBuild(deps, {
    projectCode: revision.projectCode,
    variantId: revision.variantId,
    commit,
    origin: 'variant-mainline-updated',
  });
  if (!build.ok) return build;
  return ok({ kind: 'requested', build: build.value });
}
