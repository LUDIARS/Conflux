import type { DecisionDeps } from '../../adoption-decisions/application/decision-use-cases.ts';
import type { FlowDeps } from '../../evolution-streams/application/flow-use-cases.ts';
import type { OverviewDeps } from '../../evolution-streams/application/project-overview.ts';
import type { RequestDeps } from '../../implementation-requests/application/request-use-cases.ts';
import type { FeedbackDeps } from '../../play-feedback/application/feedback-use-cases.ts';
import type { BuildDeps } from '../../playable-results/application/build-use-cases.ts';
import type { DeployDeps } from '../../playable-results/application/deploy-use-cases.ts';
import type { WorkspaceDeps } from '../../project-workspaces/application/workspace-use-cases.ts';
import type { CcProjectRegistry } from '../../project-workspaces/ports.ts';

/** Everything the delivery surface needs; assembled once in the composition root. */
export type AppDeps = WorkspaceDeps &
  FlowDeps &
  OverviewDeps &
  FeedbackDeps &
  RequestDeps &
  BuildDeps &
  DeployDeps &
  DecisionDeps & {
    readonly registry: CcProjectRegistry;
    /** Shared secret the Cc hooks present; undefined disables hook intake (503). */
    readonly hookToken: string | undefined;
  };
