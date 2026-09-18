import { createTide, createVariant, recordRevision } from '../../../evolution-streams/application/flow-use-cases.ts';
import type { RuleChange, RuleEntry } from '../../../evolution-streams/domain/model.ts';
import { onRevisionRecorded } from '../../../playable-results/application/flow-trigger.ts';
import { ok } from '../../../shared/result.ts';
import type { AppDeps } from '../app-deps.ts';
import { BadRequestError, optStr, readJson, str } from '../request-parsing.ts';
import { resultResponse } from '../responses.ts';
import type { Router } from '../router.ts';

function rules(value: unknown): RuleEntry[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((r) => r && typeof r.key === 'string' && typeof r.text === 'string')) {
    throw new BadRequestError('rules must be [{key,text}]');
  }
  return value as RuleEntry[];
}

function changes(value: unknown): RuleChange[] {
  if (value === undefined) return [];
  const valid = (x: unknown) => x === undefined || typeof x === 'string';
  if (!Array.isArray(value) || !value.every((c) => c && typeof c.key === 'string' && valid(c.before) && valid(c.after))) {
    throw new BadRequestError('ruleChanges must be [{key,before?,after?}]');
  }
  return value as RuleChange[];
}

export function registerFlowApi(router: Router, deps: AppDeps): void {
  router.add('POST', '/api/projects/:code/tides', async (req, p) => {
    const b = readJson(req);
    return resultResponse(await createTide(deps, { projectCode: p.code as string, slug: str(b, 'slug'), title: str(b, 'title'), concept: str(b, 'concept') }), 201);
  });

  router.add('POST', '/api/projects/:code/variants', async (req, p) => {
    const b = readJson(req);
    const parent = optStr(b, 'branchedFromVariantId');
    const commit = optStr(b, 'branchedFromCommit');
    return resultResponse(
      await createVariant(deps, {
        projectCode: p.code as string,
        tideId: str(b, 'tideId'),
        slug: str(b, 'slug'),
        title: str(b, 'title'),
        concept: str(b, 'concept'),
        rules: rules(b.rules),
        ...(parent ? { branchedFrom: { variantId: parent, ...(commit ? { commit } : {}) } } : {}),
      }),
      201,
    );
  });

  router.add('POST', '/api/projects/:code/variants/:variantId/revisions', async (req, p) => {
    const b = readJson(req);
    const commit = optStr(b, 'commit');
    const revision = await recordRevision(deps, {
      projectCode: p.code as string,
      variantId: p.variantId as string,
      intent: str(b, 'intent'),
      summary: optStr(b, 'summary') ?? '',
      ruleChanges: changes(b.ruleChanges),
      gitRef: { branch: str(b, 'branch'), ...(commit ? { commit } : {}) },
    });
    if (!revision.ok) return resultResponse(revision);
    const trigger = await onRevisionRecorded(deps, revision.value);
    return resultResponse(ok({ revision: revision.value, build: trigger.ok ? trigger.value : { kind: 'skipped', reason: trigger.error.message } }), 201);
  });
}
