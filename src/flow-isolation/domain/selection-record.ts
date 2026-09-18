import type { ExternalOutcome } from '../../shared/external-outcome.ts';
import type { FlowSelection } from './selection.ts';

export type SelectionState = 'selected' | 'rejected' | 'not_connected' | 'unknown';

/** History of selections sent to the Cc harness, per Cc session. */
export interface SelectionRecord {
  readonly id: string;
  readonly projectCode: string;
  readonly sessionId: string;
  readonly variantId: string;
  readonly selection: FlowSelection;
  readonly state: SelectionState;
  readonly detail?: string;
  readonly requestedAt: string;
}

export function selectionStateOf(outcome: ExternalOutcome<unknown>): { readonly state: SelectionState; readonly detail?: string } {
  switch (outcome.kind) {
    case 'accepted':
      return { state: 'selected' };
    case 'rejected':
      return { state: 'rejected', detail: `${outcome.status}: ${outcome.detail}` };
    case 'not_connected':
      return { state: 'not_connected', detail: outcome.reason };
    case 'unknown':
      return { state: 'unknown', detail: outcome.reason };
  }
}

export function describeSelectionState(state: SelectionState): string {
  const labels: Record<SelectionState, string> = {
    selected: 'Cc harness に選択を登録済み',
    rejected: 'Cc harness が選択を拒否',
    not_connected: 'Cc harness 未接続 (未配備)',
    unknown: 'Cc harness の結果不明',
  };
  return labels[state];
}
