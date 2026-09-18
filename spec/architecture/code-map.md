# コード対応表

各ファイルが実装・検証する仕様とドメイン。所属の正本は `spec/domains/*.domain.json`、仕様本文は `spec/feature/*.md`。

## evolution-streams (CF-FLOW-001 / CF-GRAPH-001)

- `src/evolution-streams/application/flow-use-cases.ts`
- `src/evolution-streams/application/project-overview.ts`
- `src/evolution-streams/domain/branch-naming.ts`
- `src/evolution-streams/domain/flow-graph.ts`
- `src/evolution-streams/domain/flow-rules.ts`
- `src/evolution-streams/domain/graph-layout.ts`
- `src/evolution-streams/domain/model.ts`
- `src/evolution-streams/domain/slug.ts`
- `src/evolution-streams/domain/variant-comparison.ts`
- `tests/evolution-streams/branch-naming.test.ts`
- `tests/evolution-streams/flow-graph.test.ts`
- `tests/evolution-streams/flow-rules.test.ts`
- `tests/evolution-streams/flow-use-cases.test.ts`

## play-feedback (CF-COMMENT-001 / CF-DEBUG-001)

- `src/play-feedback/application/feedback-use-cases.ts`
- `src/play-feedback/domain/comment-rules.ts`
- `src/play-feedback/domain/debug-intake.ts`
- `src/play-feedback/domain/model.ts`
- `src/play-feedback/domain/rating-rules.ts`
- `src/play-feedback/domain/trace.ts`
- `tests/play-feedback/feedback-rules.test.ts`
- `tests/play-feedback/feedback-use-cases.test.ts`

## adoption-decisions (CF-MERGE-001)

- `src/adoption-decisions/application/decision-use-cases.ts`
- `src/adoption-decisions/domain/decision-rules.ts`
- `src/adoption-decisions/domain/model.ts`
- `tests/adoption-decisions/decision.test.ts`

## project-workspaces (CF-PROJECT-001)

- `src/project-workspaces/application/workspace-use-cases.ts`
- `src/project-workspaces/domain/flow-observation.ts`
- `src/project-workspaces/domain/model.ts`
- `src/project-workspaces/domain/workspace-rules.ts`
- `src/project-workspaces/ports.ts`
- `tests/project-workspaces/workspace-rules.test.ts`
- `tests/project-workspaces/workspace-use-cases.test.ts`

## implementation-requests (CF-SPAWN-001)

- `src/implementation-requests/application/request-use-cases.ts`
- `src/implementation-requests/domain/model.ts`
- `src/implementation-requests/domain/request-rules.ts`
- `src/implementation-requests/ports.ts`
- `tests/implementation-requests/request-use-cases.test.ts`

## playable-results (CF-ARTIFACT-001 / CF-BUILD-001 / CF-DEPLOY-001)

- `src/playable-results/application/build-use-cases.ts`
- `src/playable-results/application/deploy-use-cases.ts`
- `src/playable-results/application/flow-trigger.ts`
- `src/playable-results/domain/build-events.ts`
- `src/playable-results/domain/build-requests.ts`
- `src/playable-results/domain/deploy-authorization.ts`
- `src/playable-results/domain/model.ts`
- `src/playable-results/domain/result-status.ts`
- `src/playable-results/ports.ts`
- `tests/playable-results/deploy-authorization.test.ts`
- `tests/playable-results/result-rules.test.ts`
- `tests/playable-results/result-use-cases.test.ts`

## flow-isolation (CF-HARNESS-001)

- `src/flow-isolation/application/selection-use-cases.ts`
- `src/flow-isolation/domain/selection-record.ts`
- `src/flow-isolation/domain/selection.ts`
- `src/flow-isolation/ports.ts`
- `tests/flow-isolation/selection.test.ts`

## platform-foundation (CF-DESIGN-001 (基盤・配信面・Cc adapter))

- `contracts/admit-debug-post.contract.ts`
- `contracts/apply-integration-report.contract.ts`
- `contracts/apply-rule-changes.contract.ts`
- `contracts/assess-checkout.contract.ts`
- `contracts/authorize-deploy.contract.ts`
- `contracts/contract-types.ts`
- `contracts/next-spawn-action.contract.ts`
- `contracts/plan-comment.contract.ts`
- `contracts/plan-decision.contract.ts`
- `contracts/plan-flow-build.contract.ts`
- `contracts/plan-variant.contract.ts`
- `contracts/plan-workspace.contract.ts`
- `contracts/project-flow-graph.contract.ts`
- `contracts/summarize-ratings.contract.ts`
- `contracts/variant-result-status.contract.ts`
- `src/adapters/cc/cc-build-trigger-gateway.ts`
- `src/adapters/cc/cc-harness-gateway.ts`
- `src/adapters/cc/cc-http-client.ts`
- `src/adapters/cc/cc-identity-gateway.ts`
- `src/adapters/cc/cc-project-registry.ts`
- `src/adapters/cc/cc-spawn-gateway.ts`
- `src/adapters/cc/status-mapping.ts`
- `src/adapters/compose.ts`
- `src/adapters/config/load-config.ts`
- `src/adapters/deploy/unconfigured-deploy-gateway.ts`
- `src/adapters/http/api/decision-api.ts`
- `src/adapters/http/api/feedback-api.ts`
- `src/adapters/http/api/flow-api.ts`
- `src/adapters/http/api/hook-api.ts`
- `src/adapters/http/api/results-api.ts`
- `src/adapters/http/api/work-api.ts`
- `src/adapters/http/api/workspace-api.ts`
- `src/adapters/http/app-deps.ts`
- `src/adapters/http/create-app.ts`
- `src/adapters/http/html/escape.ts`
- `src/adapters/http/html/graph-svg.ts`
- `src/adapters/http/html/layout.ts`
- `src/adapters/http/html/project-page.ts`
- `src/adapters/http/html/variant-forms.ts`
- `src/adapters/http/html/variant-sections.ts`
- `src/adapters/http/http-types.ts`
- `src/adapters/http/node-server.ts`
- `src/adapters/http/page-routes.ts`
- `src/adapters/http/request-parsing.ts`
- `src/adapters/http/responses.ts`
- `src/adapters/http/router.ts`
- `src/adapters/storage/json-file-database.ts`
- `src/adapters/storage/memory-database.ts`
- `src/main.ts`
- `src/shared/external-outcome.ts`
- `src/shared/record-store.ts`
- `src/shared/result.ts`
- `src/shared/runtime.ts`
- `tests/adapters/cc-gateways.test.ts`
- `tests/adapters/http-app.test.ts`
- `tests/adapters/storage-and-config.test.ts`
- `tests/shared/contracts.test.ts`
- `tests/support/fixtures.ts`
- `tests/support/seed.ts`
