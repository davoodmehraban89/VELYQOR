# Staged alert-state and outbox integration — 2026-10-22

**Review only; NOT production.** [Draft PR #35](https://github.com/davoodmehraban89/VELYQOR/pull/35) is intentionally STACKED on [Draft PR #34](https://github.com/davoodmehraban89/VELYQOR/pull/34), and imports the existing [PR #33 domain engine](https://github.com/davoodmehraban89/VELYQOR/pull/33) as a trusted **injected dependency**. Nothing has been merged, deployed to Cloudflare, or run on Neon.

## Completed within this isolated scope

1. [db/migrations/0006_alert_runtime_atomic.sql](../../db/migrations/0006_alert_runtime_atomic.sql) intentionally leaves the blocked \`0005_navasan_private_daily_ohlc.sql\` unchanged. It creates a per-user/per-rule versioned \`alert_rule_runtime\` row, an opt-in consent registry storing only opaque recipient identifiers, and one SQL \`alert_rule_commit\` operation.
2. **Transactional atomicity:** PostgreSQL row lock + revision compare-and-swap (CAS). On a valid terminal trigger, \`notification_outbox_enqueue\` from PR #34 executes in the SAME transaction as saving \`TRIGGERED\` state. Rollback on missing/revoked consent or invalid event leaves neither trigger state nor notification. Concurrent evaluations of the same revision cannot both emit.
3. **Fail-closed provenance:** A transition into TRIGGERED must contain matching event key, trigger/sample timestamps, an unsuspended quality gate with matching last-sample/accepted-timestamp, and an explicitly consented recipient whose database consent row is locked. Client-supplied \`NOTIFIED\` and \`CLOSED\` phases cannot be forged through this commit operation.
4. [Coordinator](../../packages/market-domain/src/alert-postgres-coordinator.mjs) accepts injected \`evaluateQuoteGate\` and \`stepAlert\` functions from PR #33, a verified server principal and a PostgreSQL \`query\` adapter. It blocks mismatched provider/instrument/quote-side and any missing **public display + derived alerts + historical storage licensing** BEFORE storing source prices. Its gate-to-rule-to-event bindings check price/time/source, rule identity and the explicit information-only label. It retries an optimistic version conflict at most three times and performs no network sending.
5. **Data minimization:** outbox persists only event key, user UUID, channel and opaque recipient reference; rule runtime stores quote information required for spike/trailing calculations, therefore historical-storage permission is mandatory. No bot token, chat ID, API key, broker credentials or order instructions are stored.

## Test evidence (read only from source repository)

- SQL invariant tests run against a fresh PostgreSQL 18 service on GitHub Actions and **ROLLBACK test fixtures**. They assert no unconsented/revoked send, correct CAS revisions, exactly one terminal event, no duplicate enqueue, no public permissions and a quality gate that is not suspended.
- [scripts/check-alert-runtime-concurrency.mjs](../../scripts/check-alert-runtime-concurrency.mjs) refuses any host other than local PostgreSQL, tests two genuinely separate PostgreSQL sessions racing to commit the same rule/revision and asserts **one TRIGGERED event + one outbox row**.
- [Coordinator unit tests](../../packages/market-domain/test/alert-postgres-coordinator.test.mjs): authorization, no storage without rights, source/side/price forgery, stale data, conflict retries and idempotency.
- [Pinned real-engine test](../../scripts/test-alert-coordinator-with-pr33.test.mjs): CI uses immutable PR #33 commit \`52ebe040d661d67d447d20afe5f49769ec7a095b\` and executes **the actual unchanged gate and stepAlert** functions against the coordinator. This avoids calling a fabricated local stub the real engine.
- **Latest head SHA checks** must be read before declaring CI passed; prior successful runs do not automatically prove a later commit.

## Important boundaries

- **Not production-integrated:** no trust-boundary-reviewed HTTP endpoint, authenticated user session plumbing, rights registry backed by provider contracts, recipient resolver, actual Bale send, worker cron schedule, PWA UI or deployment artifact.
- **No guaranteed exactly-once delivery.** SQL CAS ensures no duplicate logical outbox event for this rule instance. An HTTP send can still fail ambiguously; PR #34 terminal UNKNOWN halts retries instead of promising delivery.
- **No market-data rights assumed.** \`observation.permission\` is an attribute supplied by a TRUSTED server-side contract reviewer; a browser may not assert its own redisplay/storage rights. Unknown rights are a hard block.
- **No authorization grants on PostgreSQL functions or tables** were created. A future reviewed server principal and tenant-specific access policy are required before any production connection. SQL tests currently use a disposable owner role, NOT a production service role.
- **State format:** \`state.alert\` follows PR #33 \`stepAlert\`; \`state.gate\` follows PR #33 \`evaluateQuoteGate\`. The gate stores price history as minimal quality context, hence all storage must be separately licensed.
- **Three independent human/AI agents have not reviewed this PR.** GitHub CI jobs are evidence of tests, not evidence of independent agents.
- Earlier iOS/Safari blank-screen incident and exact v26 Worker backend source remain unresolved and unrelated to this SQL-only work.

## Safe delivery and rollback

No production migration, Merge, Cloudflare deployment, Neon connection, user message, provider request or external cost was performed. Close this Draft PR to discard the proposal with no user data change. Before future release, the dependency order must be reconciled: #34 schema review, #33 domain engine review, #35 integration, then staging/real-user evidence, followed by separately approved merges and deployment. Do not apply migration \`0005_navasan_private_daily_ohlc.sql\`.

**Still incomplete:** external provider redistribution and historical-storage license, validated buy/sell source fields, authentication, verified bot recipient/send/read acknowledgement, real device crash reproduction, multi-tenant least-privilege role, and approved production rollout.
