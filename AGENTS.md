# VELYQOR Engineering Rules

## Mission
Build VELYQOR as a commercial-grade market intelligence platform. Correctness, provenance, security, maintainability, and observable behavior take priority over demo speed.

## Operating model
One coordinator owns scope, sequencing, dependencies, acceptance gates, and integration. Specialist ownership is split into Market Data & Quant, Platform & Database, Chart & UX, AI/News/Research, and QA/Security/Release. Every task has exactly one primary owner.

## Mandatory rules
1. Read this file and `PROJECT_STATE.md` before modifying the repository.
2. Inspect the real repository/runtime state before proposing reconstruction.
3. Do not fabricate data, test results, deployment state, provider availability, or connector state.
4. Do not expose secrets or commit credentials.
5. Use current official documentation/Context7 for version-sensitive APIs.
6. New behavior and bug fixes follow test-first development where executable test infrastructure exists.
7. Market calculations must be deterministic, unit-explicit, timestamp-aware, and reproducible.
8. Raw provider observations are immutable audit evidence; normalization creates separate canonical records.
9. Provider-specific parsing and symbols must not leak into the core domain.
10. All backend canonical timestamps are UTC. UI localization is a presentation concern.
11. A stale or invalid price must never be presented as healthy live data.
12. Derived values must retain source timestamps, source values, formula/calculation version, and quality status.
13. AI output is explanatory/analytical evidence, never authoritative market truth.
14. AI/signals may never directly execute an order. A future trading layer requires independent risk and order management.
15. Avoid premature microservices. MVP architecture is a modular monolith plus ingestion workers.
16. PostgreSQL is the canonical market/application datastore. Edge stores are caches/coordination mechanisms only.
17. Destructive, public, paid, or sensitive-access actions require explicit authorization unless already specifically authorized for that action.

## Definition of Done
A task is Done only when implementation exists, acceptance criteria were checked, relevant tests pass, documentation is updated when needed, security/data-quality impact is considered, CI is green when available, and no material unresolved blocker is hidden.

## Change ledger
For multi-step work, update `PROJECT_STATE.md` with material decisions, completed work, open risks, blockers, and next checkpoint. Never mark unverified work complete.
