import type { AdoptionDecision } from './model.ts';

/** Manual decisions include historical records written before origin was stored. */
export function effectiveDecisions(decisions: readonly AdoptionDecision[]): ReadonlyMap<string, AdoptionDecision> {
  const effective = new Map<string, AdoptionDecision>();
  for (const entry of decisions) {
    const previous = effective.get(entry.variantId);
    if (!previous || (previous.automation && !entry.automation)
      || (Boolean(previous.automation) === Boolean(entry.automation) && entry.decidedAt >= previous.decidedAt)) {
      effective.set(entry.variantId, entry);
    }
  }
  return effective;
}
