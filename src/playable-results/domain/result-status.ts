import type { Artifact, Build } from './model.ts';

export type TargetResultState =
  | 'no_target'
  | 'not_built'
  | 'requested'
  | 'running'
  | 'failed'
  | 'unknown'
  | 'not_connected'
  | 'succeeded_without_artifact'
  | 'playable';

export interface PlayableSnapshot {
  readonly build: Build;
  readonly artifacts: readonly Artifact[];
  /** False when this is an older build than the variant's target commit. */
  readonly isTarget: boolean;
}

export interface VariantResultStatus {
  readonly targetCommit?: string;
  readonly target: TargetResultState;
  readonly targetBuild?: Build;
  readonly targetArtifacts: readonly Artifact[];
  /** Most recent build that did produce artifacts; may be a past version. */
  readonly lastPlayable?: PlayableSnapshot;
}

function byRequestedAt(a: Build, b: Build): number {
  return a.requestedAt < b.requestedAt ? -1 : a.requestedAt > b.requestedAt ? 1 : 0;
}

/**
 * Result status of one variant (CF-ARTIFACT-001). The target is the variant's latest
 * recorded commit; a failed target never borrows an older build's success, which is
 * reported separately as `lastPlayable` with `isTarget: false`.
 */
export function variantResultStatus(input: {
  readonly variantId: string;
  readonly targetCommit?: string;
  readonly builds: readonly Build[];
  readonly artifacts: readonly Artifact[];
}): VariantResultStatus {
  const builds = input.builds.filter((b) => b.variantId === input.variantId).sort(byRequestedAt);
  const artifactsOf = (build: Build) => input.artifacts.filter((a) => a.buildId === build.id);

  const playable = builds.filter((b) => b.state === 'succeeded' && artifactsOf(b).length > 0);
  const lastPlayableBuild = playable.at(-1);
  const lastPlayable = lastPlayableBuild
    ? {
        build: lastPlayableBuild,
        artifacts: artifactsOf(lastPlayableBuild),
        isTarget: lastPlayableBuild.commit === input.targetCommit,
      }
    : undefined;

  if (!input.targetCommit) {
    return { target: 'no_target', targetArtifacts: [], ...(lastPlayable ? { lastPlayable } : {}) };
  }
  const targetBuild = builds.filter((b) => b.commit === input.targetCommit).at(-1);
  if (!targetBuild) {
    return { targetCommit: input.targetCommit, target: 'not_built', targetArtifacts: [], ...(lastPlayable ? { lastPlayable } : {}) };
  }
  const targetArtifacts = artifactsOf(targetBuild);
  const target: TargetResultState =
    targetBuild.state === 'succeeded'
      ? targetArtifacts.length > 0
        ? 'playable'
        : 'succeeded_without_artifact'
      : targetBuild.state;
  return {
    targetCommit: input.targetCommit,
    target,
    targetBuild,
    targetArtifacts,
    ...(lastPlayable ? { lastPlayable } : {}),
  };
}

/** A tide/variant result counts as complete only when its target version is playable. */
export function isResultComplete(status: VariantResultStatus): boolean {
  return status.target === 'playable';
}

export function describeTargetState(state: TargetResultState): string {
  const labels: Record<TargetResultState, string> = {
    no_target: '対象コミット未記録',
    not_built: '未ビルド',
    requested: 'ビルド依頼中',
    running: 'ビルド中',
    failed: 'ビルド失敗',
    unknown: 'ビルド結果不明 (照合が必要)',
    not_connected: 'ビルド経路未接続',
    succeeded_without_artifact: 'ビルド成功だが成果物なし (未完了)',
    playable: '試遊可能',
  };
  return labels[state];
}
