import type { BranchNamingPolicy } from '../../evolution-streams/domain/branch-naming.ts';

export type SpawnDestinationKind = 'subsidiary' | 'discord' | 'slack';

/**
 * A preconfigured place a Cf work request may be spawned to. Cc owns the actual
 * affiliation/delivery; Cf only keeps the address it will hand over.
 */
export interface SpawnDestination {
  readonly id: string;
  readonly kind: SpawnDestinationKind;
  readonly label: string;
  readonly address: Readonly<Record<string, string>>;
}

export interface RatingItem {
  readonly key: string;
  readonly label: string;
}

/**
 * The scale ratings are posted on (CF-DEBUG-001). Settled on 2026-09-20 as one axis, how much fun
 * it was, from 1 to 5; a project may declare its own. Records written before that may have none,
 * and ratings stay refused for those until the project is configured again.
 */
export interface RatingScale {
  readonly min: number;
  readonly max: number;
  readonly items: readonly RatingItem[];
}

export type BuildTrigger = 'variant-mainline-updated' | 'work-branch-submitted';

export interface BuildSettings {
  readonly triggers: readonly BuildTrigger[];
  readonly platforms: readonly string[];
}

/**
 * Where a build may be deployed and which Cc role names count as "manager or above". The
 * environment was settled on 2026-09-20 as one place to try things in; the role names are still
 * open, because Cc has no role vocabulary to check against. Both are data, and an empty list
 * means deploy is not permitted at all — which is what an empty `managerRoles` still says.
 */
export interface DeploySettings {
  readonly environments: readonly string[];
  readonly managerRoles: readonly string[];
}

/**
 * Cf Flow on/off is owned by Cc (`project_codes.conflux_flow`). Cf only stores what it observed.
 */
export type FlowObservation =
  | { readonly state: 'enabled' | 'disabled'; readonly observedAt: string }
  | { readonly state: 'not_connected' | 'unknown'; readonly observedAt?: string; readonly reason: string };

export interface ProjectWorkspace {
  /** Equal to projectCode; one workspace per Cf project. */
  readonly id: string;
  readonly projectCode: string;
  readonly name: string;
  /** Project code as registered in Cc (may differ from the Cf code). */
  readonly ccProjectCode: string;
  /** Settled on 2026-09-20; absent only on records written before a project was configured again. */
  readonly branchNaming?: BranchNamingPolicy;
  readonly spawnDestinations: readonly SpawnDestination[];
  readonly ratingScale?: RatingScale;
  readonly build: BuildSettings;
  readonly deploy: DeploySettings;
  /** Whether the game's debug screen may post here. Effective only while Cc reports conflux_flow = true. */
  readonly debugIntake: boolean;
  readonly flowObservation: FlowObservation;
  readonly createdAt: string;
  readonly updatedAt: string;
}
