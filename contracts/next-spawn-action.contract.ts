import type { nextSpawnAction } from '../src/implementation-requests/domain/request-rules.ts';
import type { ContractOf } from './contract-types.ts';

/** C-10: a request that may have reached Cc is never sent again without reconciliation. */
export default {
  post: (action, request) => !(request.state === 'requested' || request.state === 'unknown') || action !== 'send' || 'uncertain request resent',
} satisfies ContractOf<typeof nextSpawnAction>;
