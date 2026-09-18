export type Verdict = 'adopted' | 'declined';

export type IntegrationSource = 'cc' | 'revisor' | 'github';

/**
 * Code integration is a fact reported by Cc/Rv/GitHub, separate from the human verdict
 * (CF-MERGE-001). An adopted decision starts as `awaiting` and is never shown as integrated
 * until a report arrives.
 */
export type IntegrationStatus =
  | { readonly state: 'not_applicable' }
  | { readonly state: 'awaiting' }
  | { readonly state: 'integrated'; readonly source: IntegrationSource; readonly ref: string; readonly reportedAt: string }
  | { readonly state: 'integration_failed'; readonly source: IntegrationSource; readonly detail: string; readonly reportedAt: string };

export interface AdoptionTarget {
  readonly commit?: string;
  readonly buildId?: string;
  readonly artifactIds: readonly string[];
}

export interface AdoptionDecision {
  readonly id: string;
  readonly projectCode: string;
  readonly tideId: string;
  readonly variantId: string;
  readonly verdict: Verdict;
  readonly target: AdoptionTarget;
  readonly reason: string;
  readonly decidedBy: string;
  readonly relatedCommentIds: readonly string[];
  /** Rating summary text visible at decision time, kept so later rating changes do not rewrite history. */
  readonly ratingDigest?: string;
  readonly integration: IntegrationStatus;
  readonly decidedAt: string;
}
