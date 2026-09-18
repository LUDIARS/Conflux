import { fail, ok, type Result } from '../../shared/result.ts';
import type { GitReference, RuleChange, RuleEntry, Revision, Tide, Variant } from './model.ts';
import { validateSlug } from './slug.ts';

export interface TideDraft {
  readonly projectCode: string;
  readonly slug: string;
  readonly title: string;
  readonly concept: string;
}

export interface VariantDraft {
  readonly projectCode: string;
  readonly tideId: string;
  readonly slug: string;
  readonly title: string;
  readonly concept: string;
  readonly rules: readonly RuleEntry[];
  readonly branchedFrom?: { readonly variantId: string; readonly commit?: string };
}

export interface RevisionDraft {
  readonly projectCode: string;
  readonly variantId: string;
  readonly intent: string;
  readonly summary: string;
  readonly ruleChanges: readonly RuleChange[];
  readonly gitRef: GitReference;
}

export interface Stamp {
  readonly id: string;
  readonly at: string;
}

function requireText(label: string, value: string): Result<string> {
  const trimmed = value.trim();
  return trimmed.length > 0 ? ok(trimmed) : fail('missing_field', `${label} を入力してください`);
}

export function planTide(existing: readonly Tide[], draft: TideDraft, stamp: Stamp): Result<Tide> {
  const slug = validateSlug('潮流', draft.slug);
  if (!slug.ok) return slug;
  const title = requireText('潮流名', draft.title);
  if (!title.ok) return title;
  const concept = requireText('潮流のコンセプト', draft.concept);
  if (!concept.ok) return concept;
  if (existing.some((t) => t.projectCode === draft.projectCode && t.slug === draft.slug)) {
    return fail('duplicate_tide', `潮流 ${draft.slug} は既にあります`);
  }
  return ok({
    id: stamp.id,
    projectCode: draft.projectCode,
    slug: slug.value,
    title: title.value,
    concept: concept.value,
    createdAt: stamp.at,
  });
}

function validateRules(rules: readonly RuleEntry[]): Result<readonly RuleEntry[]> {
  const keys = new Set<string>();
  for (const rule of rules) {
    if (rule.key.trim().length === 0) return fail('invalid_rule', 'ルールのキーが空です');
    if (keys.has(rule.key)) return fail('invalid_rule', `ルール ${rule.key} が重複しています`);
    keys.add(rule.key);
  }
  return ok(rules);
}

export function planVariant(
  tides: readonly Tide[],
  variants: readonly Variant[],
  draft: VariantDraft,
  stamp: Stamp,
): Result<Variant> {
  const tide = tides.find((t) => t.id === draft.tideId);
  if (!tide || tide.projectCode !== draft.projectCode) {
    return fail('tide_not_found', '指定した潮流がこのプロジェクトにありません');
  }
  const slug = validateSlug('亜流', draft.slug);
  if (!slug.ok) return slug;
  const title = requireText('亜流名', draft.title);
  if (!title.ok) return title;
  const concept = requireText('亜流のコンセプト', draft.concept);
  if (!concept.ok) return concept;
  const rules = validateRules(draft.rules);
  if (!rules.ok) return rules;
  if (variants.some((v) => v.tideId === tide.id && v.slug === draft.slug)) {
    return fail('duplicate_variant', `亜流 ${tide.slug}/${draft.slug} は既にあります`);
  }
  if (draft.branchedFrom) {
    const parent = variants.find((v) => v.id === draft.branchedFrom?.variantId);
    if (!parent || parent.projectCode !== draft.projectCode) {
      return fail('parent_not_found', '分岐元の亜流がこのプロジェクトにありません');
    }
  }
  return ok({
    id: stamp.id,
    projectCode: draft.projectCode,
    tideId: tide.id,
    slug: slug.value,
    title: title.value,
    concept: concept.value,
    rules: rules.value,
    ...(draft.branchedFrom ? { branchedFrom: draft.branchedFrom } : {}),
    createdAt: stamp.at,
  });
}

/**
 * Applies rule changes to one variant's rule set. `before` must match the current text,
 * so a change written against another variant (or a stale view) is rejected instead of
 * silently overwriting history.
 */
export function applyRuleChanges(rules: readonly RuleEntry[], changes: readonly RuleChange[]): Result<readonly RuleEntry[]> {
  const next = new Map(rules.map((r) => [r.key, r.text] as const));
  const seen = new Set<string>();
  for (const change of changes) {
    if (seen.has(change.key)) return fail('invalid_rule_change', `ルール ${change.key} の変更が重複しています`);
    seen.add(change.key);
    const current = next.get(change.key);
    if (current !== change.before) {
      return fail('rule_conflict', `ルール ${change.key} の変更前の内容が現在の亜流と一致しません`);
    }
    if (change.before === undefined && change.after === undefined) {
      return fail('invalid_rule_change', `ルール ${change.key} の変更内容が空です`);
    }
    if (change.after === undefined) next.delete(change.key);
    else next.set(change.key, change.after);
  }
  return ok([...next.entries()].map(([key, text]) => ({ key, text })));
}

export function planRevision(
  variant: Variant,
  draft: RevisionDraft,
  stamp: Stamp,
): Result<{ readonly revision: Revision; readonly variant: Variant }> {
  if (variant.projectCode !== draft.projectCode || variant.id !== draft.variantId) {
    return fail('variant_mismatch', '改修の対象亜流がこのプロジェクトの亜流と一致しません');
  }
  const intent = requireText('改修意図', draft.intent);
  if (!intent.ok) return intent;
  const branch = requireText('Git ブランチ', draft.gitRef.branch);
  if (!branch.ok) return branch;
  const rules = applyRuleChanges(variant.rules, draft.ruleChanges);
  if (!rules.ok) return rules;
  const commit = draft.gitRef.commit?.trim();
  return ok({
    revision: {
      id: stamp.id,
      projectCode: variant.projectCode,
      tideId: variant.tideId,
      variantId: variant.id,
      intent: intent.value,
      summary: draft.summary.trim(),
      ruleChanges: draft.ruleChanges,
      gitRef: commit ? { branch: branch.value, commit } : { branch: branch.value },
      createdAt: stamp.at,
    },
    variant: { ...variant, rules: rules.value },
  });
}

/** Latest commit recorded for a variant; the version its playable result must match. */
export function targetCommitOf(revisions: readonly Revision[], variantId: string): string | undefined {
  const withCommit = revisions
    .filter((r) => r.variantId === variantId && r.gitRef.commit)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  return withCommit.at(-1)?.gitRef.commit;
}
