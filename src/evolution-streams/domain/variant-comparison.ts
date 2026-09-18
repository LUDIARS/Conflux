import type { Variant } from './model.ts';

export type RuleDiffState = 'same' | 'differs' | 'only-left' | 'only-right';

export interface RuleDiffRow {
  readonly key: string;
  readonly left?: string;
  readonly right?: string;
  readonly state: RuleDiffState;
}

export interface VariantComparison {
  readonly left: { readonly id: string; readonly title: string; readonly concept: string };
  readonly right: { readonly id: string; readonly title: string; readonly concept: string };
  readonly rules: readonly RuleDiffRow[];
}

/** Side-by-side concept and rule comparison of two variants (CF-GRAPH-001). */
export function compareVariants(left: Variant, right: Variant): VariantComparison {
  const leftRules = new Map(left.rules.map((r) => [r.key, r.text] as const));
  const rightRules = new Map(right.rules.map((r) => [r.key, r.text] as const));
  const keys = [...new Set([...leftRules.keys(), ...rightRules.keys()])].sort();
  const rows = keys.map((key): RuleDiffRow => {
    const l = leftRules.get(key);
    const r = rightRules.get(key);
    if (l === undefined) return { key, right: r as string, state: 'only-right' };
    if (r === undefined) return { key, left: l, state: 'only-left' };
    return { key, left: l, right: r, state: l === r ? 'same' : 'differs' };
  });
  return {
    left: { id: left.id, title: left.title, concept: left.concept },
    right: { id: right.id, title: right.title, concept: right.concept },
    rules: rows,
  };
}
