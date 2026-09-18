import type { applyIntegrationReport } from '../src/adoption-decisions/domain/decision-rules.ts';
import type { ContractOf } from './contract-types.ts';

/** C-8: "integrated" is reached only from an adopted decision and a matching integration report. */
export default {
  post: (result, decision, report) => {
    if (!result.ok || result.value.integration.state !== 'integrated') return true;
    if (decision.integration.state === 'integrated') return true;
    return (decision.verdict === 'adopted' && report.outcome === 'integrated' && report.commit === decision.target.commit) || 'integrated without report';
  },
} satisfies ContractOf<typeof applyIntegrationReport>;
