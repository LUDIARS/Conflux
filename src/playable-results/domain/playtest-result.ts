/** A trial of a recorded build, reported by a trusted hook caller. */
export interface PlaytestResult {
  readonly id: string;
  readonly projectCode: string;
  readonly variantId: string;
  readonly buildId: string;
  readonly commit: string;
  readonly origin: 'human' | 'ai' | 'system';
  readonly summary: string;
  readonly observedAt: string;
  readonly outcome?: 'passed' | 'failed';
  readonly criticalBug?: boolean;
}
