import type { adoptionSignal } from '../src/cc-management-feed/domain/outcome-signals.ts';
import type { ContractOf } from './contract-types.ts';

export default {
  post: (signal, decision) => (
    signal.eventKey === `cf:adoption:${decision.id}` && signal.kind === 'adoption'
    && signal.projectCode === decision.projectCode && signal.targetKey === `variant/${decision.variantId}`
    && signal.origin === (decision.origin ?? 'human') && signal.observedAt === decision.decidedAt
    && signal.summary.startsWith(`${decision.verdict} ${decision.reason.replace(/\s+/g, ' ').slice(0, 64)}`)
    && signal.summary.length <= 2000
  ) || 'adoption signal lost its saved decision context',
} satisfies ContractOf<typeof adoptionSignal>;
