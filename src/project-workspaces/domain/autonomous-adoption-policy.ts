import { fail, ok, type Result } from '../../shared/result.ts';

export interface AutonomousAdoptionPolicy {
  readonly enabled: boolean;
  readonly maxActiveVariants: number;
  readonly minPlaytests: number;
  readonly minRatings: number;
  readonly minRatingScore: number;
  readonly maxCriticalBugs: number;
  readonly maxFailureRate: number;
}

export const DEFAULT_AUTONOMOUS_ADOPTION: AutonomousAdoptionPolicy = Object.freeze({
  enabled: false,
  maxActiveVariants: 3,
  minPlaytests: 3,
  minRatings: 3,
  minRatingScore: 0.75,
  maxCriticalBugs: 0,
  maxFailureRate: 0.20,
});

export function parseAutonomousAdoptionPolicy(input: Record<string, unknown>): Result<AutonomousAdoptionPolicy> {
  const defaults = DEFAULT_AUTONOMOUS_ADOPTION;
  const enabled = input.enabled === undefined ? defaults.enabled : input.enabled;
  const maxActiveVariants = input.maxActiveVariants === undefined ? defaults.maxActiveVariants : input.maxActiveVariants;
  const minPlaytests = input.minPlaytests === undefined ? defaults.minPlaytests : input.minPlaytests;
  const minRatings = input.minRatings === undefined ? defaults.minRatings : input.minRatings;
  const minRatingScore = input.minRatingScore === undefined ? defaults.minRatingScore : input.minRatingScore;
  const maxCriticalBugs = input.maxCriticalBugs === undefined ? defaults.maxCriticalBugs : input.maxCriticalBugs;
  const maxFailureRate = input.maxFailureRate === undefined ? defaults.maxFailureRate : input.maxFailureRate;
  if (typeof enabled !== 'boolean' || !count(maxActiveVariants, 1) || !count(minPlaytests, 1) || !count(minRatings, 1)
    || !count(maxCriticalBugs, 0) || !ratio(minRatingScore) || !ratio(maxFailureRate)
    || Object.keys(input).some((key) => !Object.hasOwn(defaults, key))) {
    return fail('invalid_autonomous_adoption_policy', '有効フラグ、件数、0〜1 のしきい値を確認してください');
  }
  return ok({ enabled, maxActiveVariants, minPlaytests, minRatings, minRatingScore, maxCriticalBugs, maxFailureRate });
}

function count(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}

function ratio(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value <= 1;
}
