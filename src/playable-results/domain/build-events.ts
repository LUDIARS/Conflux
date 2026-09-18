import { fail, ok, type Result } from '../../shared/result.ts';
import type { Artifact, ArtifactDelivery, Build, BuildState } from './model.ts';

export interface ReportedArtifact {
  readonly platform: string;
  readonly delivery: ArtifactDelivery;
  readonly uri: string;
  readonly sha256?: string;
  readonly sizeBytes?: number;
}

/** Event posted by the Cc build hook to `POST /api/hooks/build-events`. */
export interface BuildEvent {
  readonly dedupeKey: string;
  readonly projectCode: string;
  readonly variantId: string;
  readonly commit: string;
  readonly seq: number;
  readonly state: Extract<BuildState, 'running' | 'succeeded' | 'failed'>;
  readonly logUri?: string;
  readonly failureSummary?: string;
  readonly artifacts?: readonly ReportedArtifact[];
}

const TERMINAL: readonly BuildState[] = ['succeeded', 'failed'];

export type BuildEventEffect =
  | { readonly kind: 'ignored'; readonly reason: string; readonly build: Build }
  | { readonly kind: 'applied'; readonly build: Build; readonly artifacts: readonly Artifact[] };

function validateArtifacts(artifacts: readonly ReportedArtifact[]): Result<readonly ReportedArtifact[]> {
  for (const a of artifacts) {
    if (a.platform.trim().length === 0) return fail('invalid_artifact', '成果物の平台が空です');
    if (a.delivery !== 'download' && a.delivery !== 'deployable') return fail('invalid_artifact', '成果物の配布種別が不明です');
    if (!/^https?:\/\//.test(a.uri)) return fail('invalid_artifact', '成果物の URI は http(s) で指定してください');
  }
  return ok(artifacts);
}

/**
 * Applies one hook event. Duplicates and out-of-order events (seq not above the applied one)
 * are ignored, terminal states never regress, and the event must describe the same
 * project/variant/commit as the build it claims to update.
 */
export function applyBuildEvent(
  build: Build,
  event: BuildEvent,
  newArtifactId: () => string,
  at: string,
): Result<BuildEventEffect> {
  if (event.projectCode !== build.projectCode || event.variantId !== build.variantId || event.commit !== build.commit) {
    return fail('build_event_mismatch', 'ビルドイベントの対象がビルド記録と一致しません');
  }
  if (!Number.isInteger(event.seq) || event.seq < 1) return fail('invalid_build_event', 'イベント番号は 1 以上の整数です');
  if (event.seq <= build.eventSeq) return ok({ kind: 'ignored', reason: 'duplicate_or_stale', build });
  if (TERMINAL.includes(build.state)) return ok({ kind: 'ignored', reason: 'already_terminal', build });

  const reported = validateArtifacts(event.artifacts ?? []);
  if (!reported.ok) return reported;
  if (event.state !== 'succeeded' && reported.value.length > 0) {
    return fail('invalid_build_event', '成功以外のイベントに成果物は付けられません');
  }

  const artifacts: Artifact[] = reported.value.map((a) => ({
    id: newArtifactId(),
    projectCode: build.projectCode,
    buildId: build.id,
    tideId: build.tideId,
    variantId: build.variantId,
    commit: build.commit,
    platform: a.platform,
    delivery: a.delivery,
    uri: a.uri,
    ...(a.sha256 ? { sha256: a.sha256 } : {}),
    ...(a.sizeBytes !== undefined ? { sizeBytes: a.sizeBytes } : {}),
    createdAt: at,
  }));
  const next: Build = {
    ...build,
    state: event.state,
    eventSeq: event.seq,
    ...(event.logUri ? { logUri: event.logUri } : {}),
    ...(event.failureSummary ? { failureSummary: event.failureSummary } : {}),
    updatedAt: at,
  };
  return ok({ kind: 'applied', build: next, artifacts });
}
