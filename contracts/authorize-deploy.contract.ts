import type { authorizeDeploy } from '../src/playable-results/domain/deploy-authorization.ts';
import type { ContractOf } from './contract-types.ts';

/** C-13: only a Cc-verified manager-or-above on a configured environment is authorised. */
export default {
  post: (result, input) => {
    if (!result.ok) return true;
    const id = input.identity;
    if (id.status !== 'verified') return 'unverified caller authorised';
    if (!id.roles.some((r) => input.settings.managerRoles.includes(r))) return 'non-manager authorised';
    return input.settings.environments.includes(input.command.environment) || 'unconfigured environment authorised';
  },
} satisfies ContractOf<typeof authorizeDeploy>;
