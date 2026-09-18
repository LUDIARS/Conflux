import type { FlowObservation } from './model.ts';

/** What the Cc project registry returned for one project code. */
export type RegistryLookup =
  | { readonly kind: 'found'; readonly hasConfluxFlowField: boolean; readonly confluxFlow: unknown }
  | { readonly kind: 'missing' }
  | { readonly kind: 'not_connected'; readonly reason: string }
  | { readonly kind: 'unknown'; readonly reason: string };

/**
 * Interprets Cc's `project_codes.conflux_flow`. Only a literal `true` means enabled.
 * A registry without the field is a Cc that has not deployed the Cf setting yet (PR #1893),
 * which is "not connected" rather than "disabled".
 */
export function observeFlowFlag(lookup: RegistryLookup, now: string): FlowObservation {
  switch (lookup.kind) {
    case 'found':
      if (!lookup.hasConfluxFlowField) {
        return { state: 'not_connected', observedAt: now, reason: 'Cc の project_codes に conflux_flow が未配備' };
      }
      if (lookup.confluxFlow === true) return { state: 'enabled', observedAt: now };
      if (lookup.confluxFlow === false) return { state: 'disabled', observedAt: now };
      return { state: 'unknown', observedAt: now, reason: 'conflux_flow が boolean ではない' };
    case 'missing':
      return { state: 'unknown', observedAt: now, reason: 'Cc にプロジェクトコードが見つからない' };
    case 'not_connected':
      return { state: 'not_connected', observedAt: now, reason: lookup.reason };
    case 'unknown':
      return { state: 'unknown', observedAt: now, reason: lookup.reason };
  }
}
