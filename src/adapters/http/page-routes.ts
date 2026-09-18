import { decideAdoption } from '../../adoption-decisions/application/decision-use-cases.ts';
import { createTide, createVariant, recordRevision } from '../../evolution-streams/application/flow-use-cases.ts';
import { loadProjectOverview } from '../../evolution-streams/application/project-overview.ts';
import type { RuleChange } from '../../evolution-streams/domain/model.ts';
import { compareVariants } from '../../evolution-streams/domain/variant-comparison.ts';
import { reconcileRequest, requestImplementation } from '../../implementation-requests/application/request-use-cases.ts';
import { postComment, rateVariant } from '../../play-feedback/application/feedback-use-cases.ts';
import { retryBuild } from '../../playable-results/application/build-use-cases.ts';
import { deployArtifact } from '../../playable-results/application/deploy-use-cases.ts';
import { onRevisionRecorded } from '../../playable-results/application/flow-trigger.ts';
import { refreshFlowObservation } from '../../project-workspaces/application/workspace-use-cases.ts';
import { describeFlowObservation } from '../../project-workspaces/domain/workspace-rules.ts';
import type { Result } from '../../shared/result.ts';
import type { AppDeps } from './app-deps.ts';
import { errorBanner, page } from './html/layout.ts';
import { renderProjectIndex, renderProjectPage } from './html/project-page.ts';
import type { HttpResponse } from './http-types.ts';
import { formValue, parseRuleLines, readForm } from './request-parsing.ts';
import { htmlResponse, redirect, statusOf } from './responses.ts';
import type { Router } from './router.ts';

function csv(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** "key | before | after" per line; an empty before/after means introduced/removed. */
function parseChangeLines(text: string): RuleChange[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => {
      const [key = '', before = '', after = ''] = l.split('|').map((s) => s.trim());
      return { key, ...(before ? { before } : {}), ...(after ? { after } : {}) };
    });
}

/** Post/Redirect/Get: success returns to the variant view, failure shows the reason on it. */
function back(code: string, variantId: string | undefined, result: Result<unknown>): HttpResponse {
  const params = new URLSearchParams();
  if (variantId) params.set('variant', variantId);
  if (!result.ok) params.set('error', result.error.message);
  const qs = params.toString();
  return redirect(`/projects/${encodeURIComponent(code)}${qs ? `?${qs}` : ''}`);
}

export function registerPageRoutes(router: Router, deps: AppDeps): void {
  router.add('GET', '/', async () => {
    const workspaces = await deps.workspaces.listAll();
    return htmlResponse(200, renderProjectIndex(workspaces.map((w) => ({ code: w.projectCode, name: w.name, flow: describeFlowObservation(w.flowObservation) }))));
  });

  router.add('GET', '/projects/:code', async (req, p) => {
    const variantId = req.query.get('variant') ?? undefined;
    const overview = await loadProjectOverview(deps, p.code as string, variantId);
    if (!overview.ok) return htmlResponse(statusOf(overview.error), page('Conflux', `<main>${errorBanner(overview.error.message)}<a href="/">プロジェクト一覧へ</a></main>`));
    const compareId = req.query.get('compare');
    const other = compareId ? overview.value.variants.find((v) => v.id === compareId) : undefined;
    const comparison = overview.value.selected && other ? compareVariants(overview.value.selected.variant, other) : undefined;
    return htmlResponse(200, renderProjectPage(overview.value, comparison, req.query.get('error')));
  });

  router.add('POST', '/projects/:code/flow-status/refresh', async (_req, p) => back(p.code as string, undefined, await refreshFlowObservation(deps, p.code as string)));

  router.add('POST', '/projects/:code/tides', async (req, p) => {
    const f = readForm(req);
    const code = p.code as string;
    return back(code, undefined, await createTide(deps, { projectCode: code, slug: formValue(f, 'slug'), title: formValue(f, 'title'), concept: formValue(f, 'concept') }));
  });

  router.add('POST', '/projects/:code/variants', async (req, p) => {
    const f = readForm(req);
    const code = p.code as string;
    const parent = formValue(f, 'branchedFromVariantId');
    const commit = formValue(f, 'branchedFromCommit');
    const result = await createVariant(deps, {
      projectCode: code,
      tideId: formValue(f, 'tideId'),
      slug: formValue(f, 'slug'),
      title: formValue(f, 'title'),
      concept: formValue(f, 'concept'),
      rules: parseRuleLines(formValue(f, 'rules')),
      ...(parent ? { branchedFrom: { variantId: parent, ...(commit ? { commit } : {}) } } : {}),
    });
    return back(code, result.ok ? result.value.id : undefined, result);
  });

  router.add('POST', '/projects/:code/variants/:variantId/revisions', async (req, p) => {
    const f = readForm(req);
    const code = p.code as string;
    const variantId = p.variantId as string;
    const commit = formValue(f, 'commit').trim();
    const result = await recordRevision(deps, {
      projectCode: code,
      variantId,
      intent: formValue(f, 'intent'),
      summary: formValue(f, 'summary'),
      ruleChanges: parseChangeLines(formValue(f, 'ruleChanges')),
      gitRef: { branch: formValue(f, 'branch'), ...(commit ? { commit } : {}) },
    });
    if (result.ok) await onRevisionRecorded(deps, result.value);
    return back(code, variantId, result);
  });

  router.add('POST', '/projects/:code/variants/:variantId/comments', async (req, p) => {
    const f = readForm(req);
    const code = p.code as string;
    const variantId = p.variantId as string;
    const parentId = formValue(f, 'parentId').trim();
    const playedBuildId = formValue(f, 'playedBuildId');
    return back(
      code,
      variantId,
      await postComment(deps, {
        projectCode: code,
        variantId,
        author: { kind: 'human', name: formValue(f, 'author') },
        body: formValue(f, 'body'),
        source: 'cf-ui',
        ...(parentId ? { parentId } : {}),
        ...(playedBuildId ? { playedBuildId } : {}),
      }),
    );
  });

  router.add('POST', '/projects/:code/variants/:variantId/ratings', async (req, p) => {
    const f = readForm(req);
    const code = p.code as string;
    const variantId = p.variantId as string;
    const scores: Record<string, number> = {};
    for (const [key, value] of f) if (key.startsWith('score.')) scores[key.slice('score.'.length)] = Number(value);
    return back(code, variantId, await rateVariant(deps, { projectCode: code, variantId, playedBuildId: formValue(f, 'playedBuildId'), rater: formValue(f, 'rater'), scores }));
  });

  router.add('POST', '/projects/:code/requests', async (req, p) => {
    const f = readForm(req);
    const code = p.code as string;
    const variantId = formValue(f, 'variantId');
    return back(
      code,
      variantId,
      await requestImplementation(deps, {
        projectCode: code,
        variantId,
        destinationId: formValue(f, 'destinationId'),
        title: formValue(f, 'title'),
        brief: formValue(f, 'brief'),
        task: formValue(f, 'task'),
        sourceCommentIds: csv(formValue(f, 'sourceCommentIds')),
        requestedBy: formValue(f, 'requestedBy'),
      }),
    );
  });

  router.add('POST', '/projects/:code/requests/:requestId/reconcile', async (req, p) => {
    const f = readForm(req);
    const code = p.code as string;
    const result = await reconcileRequest(deps, { projectCode: code, requestId: p.requestId as string, resendIfAbsent: f.get('resendIfAbsent') === '1' });
    return back(code, result.ok ? result.value.variantId : undefined, result);
  });

  router.add('POST', '/projects/:code/builds/:buildId/retry', async (_req, p) => {
    const code = p.code as string;
    const result = await retryBuild(deps, { projectCode: code, buildId: p.buildId as string });
    return back(code, result.ok ? result.value.variantId : undefined, result);
  });

  router.add('POST', '/projects/:code/deployments', async (req, p) => {
    const f = readForm(req);
    const code = p.code as string;
    const token = formValue(f, 'actorToken');
    const result = await deployArtifact(
      deps,
      {
        projectCode: code,
        artifactId: formValue(f, 'artifactId'),
        environment: formValue(f, 'environment'),
        confirmArtifactId: formValue(f, 'confirmArtifactId'),
        confirmEnvironment: formValue(f, 'confirmEnvironment'),
      },
      token || undefined,
    );
    return back(code, result.ok ? result.value.variantId : undefined, result);
  });

  router.add('POST', '/projects/:code/decisions', async (req, p) => {
    const f = readForm(req);
    const code = p.code as string;
    const variantId = formValue(f, 'variantId');
    const verdict = formValue(f, 'verdict') === 'adopted' ? 'adopted' : 'declined';
    const commit = formValue(f, 'commit').trim();
    return back(
      code,
      variantId,
      await decideAdoption(deps, {
        projectCode: code,
        variantId,
        verdict,
        reason: formValue(f, 'reason'),
        decidedBy: formValue(f, 'decidedBy'),
        relatedCommentIds: csv(formValue(f, 'relatedCommentIds')),
        ...(commit ? { commit } : {}),
      }),
    );
  });
}
