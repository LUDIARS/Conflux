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

/** Rating scale is undecided (CF-DEBUG-001); a project must declare one before ratings are accepted. */
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
 * Deploy environments and the Cc role names that count as "manager or above" are undecided.
 * Both are data; empty lists mean deploy is not permitted at all.
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
