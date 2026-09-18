import { timingSafeEqual } from 'node:crypto';
import { recordIntegration } from '../../../adoption-decisions/application/decision-use-cases.ts';
import { ingestBuildEvent } from '../../../playable-results/application/build-use-cases.ts';
import type { ArtifactDelivery } from '../../../playable-results/domain/model.ts';
import type { AppDeps } from '../app-deps.ts';
import type { HttpRequest, HttpResponse } from '../http-types.ts';
import { BadRequestError, bearerToken, optStr, readJson, str } from '../request-parsing.ts';
import { jsonResponse, resultResponse } from '../responses.ts';
import type { Router } from '../router.ts';

/** Hook intake requires the shared token; without a configured token the intake is closed. */
function checkHookToken(req: HttpRequest, expected: string | undefined): HttpResponse | undefined {
  if (!expected) return jsonResponse(503, { error: 'hook_intake_not_configured', message: 'CONFLUX_HOOK_TOKEN が未設定のため Cc フックを受け付けません' });
  const given = bearerToken(req) ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return jsonResponse(401, { error: 'unauthenticated' });
  return undefined;
}

function artifacts(value: unknown) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new BadRequestError('artifacts must be an array');
  return value.map((a: Record<string, unknown>) => {
    const sha256 = optStr(a, 'sha256');
    const size = a.sizeBytes;
    if (size !== undefined && typeof size !== 'number') throw new BadRequestError('sizeBytes must be a number');
    return {
      platform: str(a, 'platform'),
      delivery: str(a, 'delivery') as ArtifactDelivery,
      uri: str(a, 'uri'),
      ...(sha256 ? { sha256 } : {}),
      ...(typeof size === 'number' ? { sizeBytes: size } : {}),
    };
  });
}

export function registerHookApi(router: Router, deps: AppDeps): void {
  router.add('POST', '/api/hooks/build-events', async (req) => {
    const denied = checkHookToken(req, deps.hookToken);
    if (denied) return denied;
    const b = readJson(req);
    const state = str(b, 'state');
    if (state !== 'running' && state !== 'succeeded' && state !== 'failed') throw new BadRequestError('state must be running|succeeded|failed');
    if (typeof b.seq !== 'number') throw new BadRequestError('seq must be a number');
    const logUri = optStr(b, 'logUri');
    const failureSummary = optStr(b, 'failureSummary');
    const reported = artifacts(b.artifacts);
    return resultResponse(
      await ingestBuildEvent(deps, {
        dedupeKey: str(b, 'dedupeKey'),
        projectCode: str(b, 'projectCode'),
        variantId: str(b, 'variantId'),
        commit: str(b, 'commit'),
        seq: b.seq,
        state,
        ...(logUri ? { logUri } : {}),
        ...(failureSummary ? { failureSummary } : {}),
        ...(reported ? { artifacts: reported } : {}),
      }),
    );
  });

  router.add('POST', '/api/hooks/integration', async (req) => {
    const denied = checkHookToken(req, deps.hookToken);
    if (denied) return denied;
    const b = readJson(req);
    const source = str(b, 'source');
    const outcome = str(b, 'outcome');
    if (source !== 'cc' && source !== 'revisor' && source !== 'github') throw new BadRequestError('source must be cc|revisor|github');
    if (outcome !== 'integrated' && outcome !== 'failed') throw new BadRequestError('outcome must be integrated|failed');
    const detail = optStr(b, 'detail');
    return resultResponse(
      await recordIntegration(deps, {
        projectCode: str(b, 'projectCode'),
        decisionId: str(b, 'decisionId'),
        source,
        commit: str(b, 'commit'),
        outcome,
        ref: str(b, 'ref'),
        ...(detail ? { detail } : {}),
      }),
    );
  });
}
