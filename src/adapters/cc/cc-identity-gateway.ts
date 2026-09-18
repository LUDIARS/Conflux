import type { IdentityVerification } from '../../playable-results/domain/deploy-authorization.ts';
import type { CcIdentityGateway } from '../../playable-results/ports.ts';
import type { CcHttpClient } from './cc-http-client.ts';

/**
 * Asks Cc who the caller is and which roles they hold. The Cc route is not defined yet;
 * without it every check is `unavailable`, which denies role-gated actions.
 */
export class HttpCcIdentityGateway implements CcIdentityGateway {
  private readonly client: CcHttpClient;
  private readonly identityPath: string | undefined;

  constructor(client: CcHttpClient, identityPath: string | undefined) {
    this.client = client;
    this.identityPath = identityPath;
  }

  async verify(actorToken: string | undefined): Promise<IdentityVerification> {
    if (!this.identityPath) return { status: 'unavailable', reason: 'Cc の役職照会経路が未定義 (CONFLUX_CC_IDENTITY_PATH 未設定)' };
    if (!actorToken) return { status: 'unauthenticated', reason: '本人確認トークンがありません' };
    const result = await this.client.request('GET', this.identityPath, undefined, { authorization: `Bearer ${actorToken}` });
    if (result.kind !== 'response') return { status: 'unavailable', reason: result.reason };
    if (result.status === 401 || result.status === 403) return { status: 'unauthenticated', reason: `Cc が本人確認を拒否 (${result.status})` };
    if (result.status < 200 || result.status >= 300) return { status: 'unavailable', reason: `Cc エラー ${result.status}` };
    const body = result.body as { actor_id?: unknown; roles?: unknown } | undefined;
    if (!body || typeof body.actor_id !== 'string' || !Array.isArray(body.roles) || !body.roles.every((r) => typeof r === 'string')) {
      return { status: 'unavailable', reason: '役職照会の応答形式を解釈できません' };
    }
    return { status: 'verified', actorId: body.actor_id, roles: body.roles as string[] };
  }
}
