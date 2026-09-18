import type { BuildTrigger } from '../../project-workspaces/domain/model.ts';

/**
 * Build lifecycle as reported by the Cc build hook (CF-BUILD-001).
 * `not_connected`: Cf asked but the Cc build route is not deployed/configured; nothing runs.
 * `unknown`: the request or a report was lost; reconcile before any rerun.
 */
export type BuildState = 'requested' | 'running' | 'succeeded' | 'failed' | 'unknown' | 'not_connected';

export type BuildOrigin = BuildTrigger | 'manual-retry' | 'hook-reported';

export interface Build {
  readonly id: string;
  readonly projectCode: string;
  readonly tideId: string;
  readonly variantId: string;
  readonly commit: string;
  readonly origin: BuildOrigin;
  /** Identity of "the same build request"; duplicate hooks resolve to the same record. */
  readonly dedupeKey: string;
  readonly retryOf?: string;
  readonly state: BuildState;
  /** Highest hook event sequence applied; older/duplicate events are ignored. */
  readonly eventSeq: number;
  readonly logUri?: string;
  readonly failureSummary?: string;
  readonly requestedAt: string;
  readonly updatedAt: string;
}

export type ArtifactDelivery = 'download' | 'deployable';

/** A playable output. Cf stores only the reference Cc reported, never the binary. */
export interface Artifact {
  readonly id: string;
  readonly projectCode: string;
  readonly buildId: string;
  readonly tideId: string;
  readonly variantId: string;
  readonly commit: string;
  readonly platform: string;
  readonly delivery: ArtifactDelivery;
  readonly uri: string;
  readonly sha256?: string;
  readonly sizeBytes?: number;
  readonly createdAt: string;
}

export type DeploymentState = 'requested' | 'succeeded' | 'failed' | 'unknown' | 'not_connected';

export interface Deployment {
  readonly id: string;
  readonly projectCode: string;
  readonly artifactId: string;
  readonly buildId: string;
  readonly variantId: string;
  readonly environment: string;
  readonly actorId: string;
  /** Roles Cc reported at the time of the check; kept for the audit trail. */
  readonly actorRoles: readonly string[];
  readonly state: DeploymentState;
  readonly detail?: string;
  readonly requestedAt: string;
  readonly updatedAt: string;
}
