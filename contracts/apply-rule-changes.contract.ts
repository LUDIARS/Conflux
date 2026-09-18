import type { applyRuleChanges } from '../src/evolution-streams/domain/flow-rules.ts';
import type { ContractOf } from './contract-types.ts';

/** C-2: a change whose `before` differs from the variant's current rule is rejected. */
export default {
  post: (result, rules, changes) => {
    const current = new Map(rules.map((r) => [r.key, r.text] as const));
    const stale = changes.some((c) => current.get(c.key) !== c.before);
    return !stale || !result.ok || 'stale rule change applied';
  },
} satisfies ContractOf<typeof applyRuleChanges>;
