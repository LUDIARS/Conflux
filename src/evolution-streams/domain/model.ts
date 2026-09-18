/**
 * Flow vocabulary (CF-FLOW-001):
 * - Tide (潮流): a large evolution direction of the game.
 * - Variant (亜流): a concrete rule system inside a tide. Each variant owns a mainline (本流).
 * - Revision (改修): one recorded change on a variant, with intent, rule diff and git reference.
 * "Flow" (流れ) is the umbrella term.
 */
export interface Tide {
  readonly id: string;
  readonly projectCode: string;
  readonly slug: string;
  readonly title: string;
  readonly concept: string;
  readonly createdAt: string;
}

export interface RuleEntry {
  readonly key: string;
  readonly text: string;
}

export interface BranchPoint {
  readonly variantId: string;
  /** Commit the variant was branched at, when known. */
  readonly commit?: string;
}

export interface Variant {
  readonly id: string;
  readonly projectCode: string;
  readonly tideId: string;
  readonly slug: string;
  readonly title: string;
  readonly concept: string;
  readonly rules: readonly RuleEntry[];
  readonly branchedFrom?: BranchPoint;
  readonly createdAt: string;
}

export interface RuleChange {
  readonly key: string;
  /** Absent when the rule is introduced by this change. */
  readonly before?: string;
  /** Absent when the rule is removed by this change. */
  readonly after?: string;
}

export interface GitReference {
  readonly branch: string;
  readonly commit?: string;
}

export interface Revision {
  readonly id: string;
  readonly projectCode: string;
  readonly tideId: string;
  readonly variantId: string;
  readonly intent: string;
  readonly summary: string;
  readonly ruleChanges: readonly RuleChange[];
  readonly gitRef: GitReference;
  readonly createdAt: string;
}
