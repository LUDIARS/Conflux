---
title: LUDIARS 9-tool design review — Conflux
type: plan
status: proposed
updated: 2026-10-17
---

# Conflux: preserve game decisions and make incomplete integrations explicit

Cf owns tides, variants, opinions, adoption and build/integration observations.
Cc owns session identity, routing and harness checkout enforcement; Rv owns review
and code integration. Actio owns tasks; Pf owns requirements; An analyses source;
Augur plans tests; Br derives summaries; Genius advises decisions. Cf must not
turn an AI opinion or missing gateway into an authorized integrated result.

Reviewed main 05cf25d: README.md, spec/feature/flow-isolation.md,
spec/architecture/cc-integration.md, src/adapters/cc/cc-harness-gateway.ts,
src/adapters/cc/cc-project-registry.ts. CF-HARNESS-001 / CF-UX-4 preserve
the selected variant mainline as the Cf Flow base. Normal flows retain their main
rule. The current README already settles this point; the handoff is not evidence
for resetting all Cf work to repository main.

Implemented documentation correction: carry that explicit exception into the
Cc boundary document and remove its stale claim that the originating PR remains
under review and undeployed. Runtime deployment remains unverified; adapters
classify actual responses rather than trusting a historical PR label.

## Priorities, rebuttals and acceptance

1. Complete Cc spawn/lookup and build/identity contracts before broadening game
   automation. Current boundary documents deliberately leave paths unset. Do not
   guess URLs to make connectivity look complete. Acceptance: request identity,
   accepted/result-unknown distinction, lookup before retry, preserved outcomes
   after ownership loss, and explicit authorization for deployment.
2. Preserve status semantics across adapters: missing endpoint or connection is
   not_connected; 5xx/timeout is unknown; a rejection is not acceptance. A missing
   conflux_flow field must not enable the feature. The current registry adapter
   already follows this rule; avoid replacing it with a permissive boolean default.
3. Keep build results, merge facts and adoption separate. Rv merge notification
   may update integration evidence, not silently approve an opinion or deploy.
   Acceptance: repeated events dedupe and out-of-order events cannot regress state.
4. An/Augur may supply revision-bound analysis/test evidence; Br consumes a summary
   and Genius supplies advice. Do not add a second editable task/specification store
   or treat an LLM proposal as human acceptance.

Source consistency and git diff --check performed. No runtime code, tests,
services or deployments were executed or changed. No speedup or completed external
integration is claimed. Recovery: revert documentation; no data or branch-history
rewrite is required. Larger gateway changes remain proposals with owner contracts.
