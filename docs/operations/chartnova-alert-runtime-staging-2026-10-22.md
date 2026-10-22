# Staged alert-state and outbox integration — 2026-10-22

**Review only; NOT production.** [Draft PR #35](https://github.com/davoodmehraban89/VELYQOR/pull/35) is intentionally STACKED on [Draft PR #34](https://github.com/davoodmehraban89/VELYQOR/pull/34), and imports the existing [PR #33 domain engine](https://github.com/davoodmehraban89/VELYQOR/pull/33) as a trusted **injected dependency**. Nothing has been merged, deployed to Cloudflare, or run on Neon.

## Completed within this isolated scope

1. [db/migrations/0006_alert_runtime_atomic.sql](../../db/migrations/0006_alert_runtime_atomic.sql) intentionally leaves the blocked `0005_navasan_private_daily_ohlc.sql` unchanged. It creates a per-user/per-rule versioned `alert_rule_runtime` row, an opt-in consent registry storing only opaque recipient identifiers, and one SQL `alert_rule_commit` operation.
2. **Transactional atomicity:** PostgreSQL row lock + revision compare-and-swap (CAS). On a valid terminal trigger, `notification_outbox_enqueue` from PR #34 executes in the SAME transaction as saving `TRIGGERED` state. Rollback on missing/revoked consent or invalid event leaves neither trigger state nor notification. Concurrent evaluations of the same revision cannot both emit.
3. **Fail-closed provenance:** A transition into TRIGGERED must contain matching event key, trigger/sample timestamps, an unsuspended quality gate with matching last-sample/accepted-timestamp, and an explicitly consented recipient whose database consent row is locked. Client-supplied `NOTIFIED` and `CLOSED` phases cannot be forged through this commit operation.
4. [Coordinator](../../packages/market-domain/src/alert-postgres-coordinator.mjs) accepts injected `evaluateQuoteGate` and `stepAlert` functions from PR #33, a verified server principal and a PostgreSQL `query` adapter. It blocks mismatched provider/instrument/quote-side and any missing **public display + derived alerts + historical storage licensing** BEFORE storing source prices. Its gate-to-rule-to-event bindings check price/time/source, rule identity and the explicit information-only label. It retries an optimistic version conflict at most three times and performs no network sending.
5. **Data minimization:** outbox persists only event key, user UUID, channel and opaque recipient reference; rule runtime stores quote information required for spike/trailing calculations, therefore historical-storage permission is mandatory. No bot token, chat ID, API key, broker credentials or order instructions are stored.

## Revoked-consent delivery safety (new)

- The proposed future sender must use SQL function `alert_notification_claim_consented`, **not** raw PR #34 `notification_outbox_claim`. The wrapper looks up each claimed row's actual **user ID, recipient reference and channel** and checks active consent from the database again before handing anything to an outbound transport.
- If consent was revoked **after enqueue but before claim**, the wrapper marks the unsent row terminal `UNKNOWN` with explicit reason `RECIPIENT_CONSENT_REVOKED_OR_MISSING`; it does NOT call any messaging provider and does not retry. Under PR #34's existing status model, `UNKNOWN` is the only non-retry terminal available without changing the approved schema. The reason differentiates revocation from a real uncertain HTTP delivery.
- To avoid starvation when old/revoked recipients are at the head of the queue, the wrapper scans at most **16** pending rows per claim, terminating revoked ones and returning the first entitled recipient if found. A larger backlog requires subsequent scheduled checks; no unbounded loop.
- PostgreSQL invariant tests cover an active consent, revoked consent, revoke-after-enqueue, repeated claim of a revoked item, multiple queued recipients and a revoked oldest entry preceding an eligible recipient.
- **Residual race**: consent can be revoked after a database claim transaction commits but before an external HTTP request. A future real sender MUST recheck consent immediately before egress, and document this unavoidable race in the operational contract. No such sender, connector or external network action exists in this PR.
- SQL privilege policy must prohibit the approved runtime sender from bypassing this wrapper via direct raw claim or table mutation. **Least-privilege role grants are not implemented here**, so no proof of fully enforced sender isolation exists.

### Test failures repaired

- One first-pass run failed because an added PL/pgSQL wrapper was incorrectly dollar-quoted. Repaired with named `$alert_claim$` delimiters.
- A follow-up test run found a missing declared local test variable `current_status`. The declaration was added; neither issue affected Neon or live users.
- Subsequent green checks validate the repaired schema on disposable PostgreSQL; failures have not been erased from GitHub Actions history.


## Test evidence (read only from source repository)

- SQL invariant tests run against a fresh PostgreSQL 18 service on GitHub Actions and **ROLLBACK test fixtures**. They assert no unconsented/revoked send, correct CAS revisions, exactly one terminal event, no duplicate enqueue, no public permissions and a quality gate that is not suspended.
- [scripts/check-alert-runtime-concurrency.mjs](../../scripts/check-alert-runtime-concurrency.mjs) refuses any host other than local PostgreSQL, tests two genuinely separate PostgreSQL sessions racing to commit the same rule/revision and asserts **one TRIGGERED event + one outbox row**.
- [Coordinator unit tests](../../packages/market-domain/test/alert-postgres-coordinator.test.mjs): authorization, no storage without rights, source/side/price forgery, stale data, conflict retries and idempotency.
- [Pinned real-engine test](../../scripts/test-alert-coordinator-with-pr33.test.mjs): CI uses immutable PR #33 commit `52ebe040d661d67d447d20afe5f49769ec7a095b` and executes **the actual unchanged gate and stepAlert** functions against the coordinator. This avoids calling a fabricated local stub the real engine.
- **Latest head SHA checks** must be read before declaring CI passed; prior successful runs do not automatically prove a later commit.

## Important boundaries

- **Not production-integrated:** no trust-boundary-reviewed HTTP endpoint, authenticated user session plumbing, rights registry backed by provider contracts, recipient resolver, actual Bale send, worker cron schedule, PWA UI or deployment artifact.
- **No guaranteed exactly-once delivery.** SQL CAS ensures no duplicate logical outbox event for this rule instance. An HTTP send can still fail ambiguously; PR #34 terminal UNKNOWN halts retries instead of promising delivery.
- **No market-data rights assumed.** `observation.permission` is an attribute supplied by a TRUSTED server-side contract reviewer; a browser may not assert its own redisplay/storage rights. Unknown rights are a hard block.
- **No authorization grants on PostgreSQL functions or tables** were created. A future reviewed server principal and tenant-specific access policy are required before any production connection. SQL tests currently use a disposable owner role, NOT a production service role.
- **State format:** `state.alert` follows PR #33 `stepAlert`; `state.gate` follows PR #33 `evaluateQuoteGate`. The gate stores price history as minimal quality context, hence all storage must be separately licensed.
- **Three independent human/AI agents have not reviewed this PR.** GitHub CI jobs are evidence of tests, not evidence of independent agents.
- Earlier iOS/Safari blank-screen incident and exact v26 Worker backend source remain unresolved and unrelated to this SQL-only work.

## Additional security review: single-use egress and private recipient binding

**Source-reviewed risks found and fixed in Draft PR #35:**

1. **Repeated sender calls could share an active DB lease and issue duplicate HTTP POSTs.** A new `send_started_at` marker in migration 0006 plus `alert_notification_begin_egress` consumes an atomic **single-use** send permit. A second/parallel caller receives `FALSE` and must not call the provider. The marker persists even after transient failures; the existing PR #34 expired-lease rule fails closed to terminal UNKNOWN, preventing blind retry.
2. **The original sender flow accepted an arbitrary chat ID unrelated to the outbox's opaque recipient UUID.** `leased-bale-dispatch.mjs` now requires a **trusted server-side recipient resolver** and validates that the resolved recipient reference exactly matches the persisted outbox recipient reference. Both SQL egress permission functions also bind the channel and recipient reference to the actual claimed row. No externally chosen chat ID is accepted.
3. **Consent can be revoked after claim but before send.** `alert_notification_egress_allowed` performs a second read-only check of the SAME row/recipient/channel/lease token directly before a network call; a revoked recipient is blocked. The wrapper uses `UNKNOWN` terminal persistence after a revoked/failed second preflight, never an automatic retry. There remains an unavoidable micro-window after the last database check before HTTP; this requires a narrowly controlled runtime sender and documented delivery-consent policy.
4. **Transport confirmation is not read confirmation.** The injected actual PR #33 `bale-once-adapter.mjs` issues at most one `sendMessage` only after private `getChat` verification. Provider `message_id` is recorded as acceptance, never proof that the user opened/read the message. Ambiguous HTTP, malformed response and preflight failure are treated as UNKNOWN.

**Tests in isolated CI:**
- `db/tests/alert_runtime_invariants.sql`: repeated same-lease permit, wrong lease token, cross-recipient UUID, wrong channel, expired lease, revoked after claim and PUBLIC execute denial.
- `scripts/check-alert-runtime-concurrency.mjs`: two separate real PostgreSQL client processes race on one send permit: expected **one TRUE, one FALSE**, one durable `send_started_at`, then revocation causes final egress authorization to return FALSE.
- `scripts/test-leased-bale-pr33.test.mjs`: imports the **exact pinned real PR #33 Bale adapter**; uses a synthetic injected transport only. It covers concurrent dispatch calls, group-chat rejection, missing/unverified recipient mapping, wrong mapping, revoked consent and unknown provider outcomes. No real bot token, human account or HTTP POST is used.

**Release-blocking trust contracts:** The `resolveRecipient` implementation, encrypted private mapping, bot token secret manager, approved least-privilege SQL role, verified source-license registry and actual opt-in are **not available**. The test resolver is synthetic and MUST NOT be presented as a live recipient mapping. These components remain **تأییدنشده**.

**Review process truth:** Functional, static/security and adversarial CI checks are separate automated jobs, but the required three independent AI/human review agents cannot be launched with the available Notion connection (`plan_required` on the Business plan). Do not assert reviewer approval or production completion.


## Safe delivery and rollback

No production migration, Merge, Cloudflare deployment, Neon connection, user message, provider request or external cost was performed. Close this Draft PR to discard the proposal with no user data change. Before future release, the dependency order must be reconciled: #34 schema review, #33 domain engine review, #35 integration, then staging/real-user evidence, followed by separately approved merges and deployment. Do not apply migration `0005_navasan_private_daily_ohlc.sql`.

**Still incomplete:** external provider redistribution and historical-storage license, validated buy/sell source fields, authentication, verified bot recipient/send/read acknowledgement, real device crash reproduction, multi-tenant least-privilege role, and approved production rollout.
