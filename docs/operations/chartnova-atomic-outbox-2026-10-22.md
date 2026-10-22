# ChartNova atomic notification outbox — isolated schema review

**Status:** draft PR; schema, functions and roll-backed test fixtures only. **No Neon schema has been modified.** No Cloudflare Worker version, user data, market price, bot token, outgoing message or live-alert state has changed.

## Why this is an independent PR

PR [#33](https://github.com/davoodmehraban89/VELYQOR/pull/33) implements pure informational alert and notification state transitions but explicitly leaves the multi-Worker **transactional, durable outbox** incomplete. The existing PostgreSQL foundation on main:
- [0001_market_core.sql](../../db/migrations/0001_market_core.sql) — source prices, instruments and providers
- [0002_workspaces.sql](../../db/migrations/0002_workspaces.sql) — \`app_users\`
- [0003_phase1_persistence_hardening.sql](../../db/migrations/0003_phase1_persistence_hardening.sql) — provenance and price uniqueness.

This PR adds only a **new, separately versioned** [0004_notification_outbox.sql](../../db/migrations/0004_notification_outbox.sql) and [SQL invariants](../../db/tests/notification_outbox_invariants.sql), starting independently from main. The untracked/local **0005_navasan_private_daily_ohlc.sql is untouched and must remain blocked.**

## Design contracts and security boundaries

- All outbound notifications are **information only**. This schema contains neither a broker order endpoint nor a trade-execution trigger.
- \`notification_outbox\` links \`app_users\` to an opaque \`recipient_ref UUID\`; no Bale chat IDs, email addresses, notification text, bot tokens, API keys or sensitive upstream payloads are stored.
- \`UNIQUE(user_id,event_key,channel,recipient_ref)\` ensures duplicate logical enqueues do not produce multiple messages for the same user and channel. Event-key generation must be versioned by the future alert-engine integrator.
- \`notification_outbox_enqueue\` inserts idempotently with \`ON CONFLICT DO NOTHING\` and resolves the existing ID without overwriting unrelated state.
- \`notification_outbox_claim\` uses one database transaction, \`SELECT ... FOR UPDATE SKIP LOCKED\` and an atomic UPDATE to acquire at most one available item per claim. A random lease token and bounded lease duration protect against unrelated workers completing each other's claims.
- **Lease expiry is terminal \`UNKNOWN\`**, not an automatic re-send: the previous worker might have delivered a message and crashed before storing the result.
- \`notification_outbox_finish\` accepts only **SENT with a provider message ID**, **REJECTED** with explicit provider non-delivery or **UNKNOWN** for timeout/ambiguous responses. A verified rejected message can be retried after a configured delay, at most \`max_attempts\` times. An unknown response **cannot be auto-retried**.
- Provider acceptance is **not read confirmation**. \`notification_outbox_acknowledge\` requires a user ID match, a previously accepted message, and a later timestamp; the caller **must separately authenticate the user** and obtain actual affirmative acknowledgement.
- SQL functions use \`SECURITY INVOKER\` and \`REVOKE ... FROM PUBLIC\`. **No runtime service DB role grants are created**. The server-side authorization boundary remains **blocked until an explicit role, RLS/grants and actual user identity mapping are reviewed**.
- There is **no user-facing Worker path**, persistent signed-in workflow or bot send call in this PR. No API changed.

## Concurrency and delivery trade-off

This protocol favors **at-most-one attempted send per ambiguous claim** over automatic liveness. This is not the same as exactly-once delivery. In particular, failure after claiming but before sending also causes \`UNKNOWN\`, requiring explicit human reconciliation. It is safer than duplicate notifications but can lead to missed notifications and is **not acceptable as a guaranteed real-time trading alert**.

Persistent row authorization must be enforced by an approved server-only Neon role, plus user-scoped queries. A generic front-end database connection must **not** receive permission to enqueue/claim/finish other users' alerts. No RLS permissions or broad runtime grants are assumed here. This outbox must not be activated until there is a verified recipient resolution store, written market-data redisplay rights and separately approved sender integration.

## Test evidence and acceptance

- \`db/tests/notification_outbox_invariants.sql\` runs inside \`BEGIN/ROLLBACK\` against a **fresh GitHub Actions PostgreSQL service**. It tests unique enqueue, invalid metadata, claim exclusion, wrong lease token, completion receipt, no duplicate completion, cross-user ACK, early ACK, retry-delay and attempt caps, ambiguous result, expired lease, late worker response, unauthorized SQL state edits, and user isolation.
- The existing [CI workflow](../../.github/workflows/ci.yml) already applies \`db/migrations/*.sql\` and runs \`db/tests/*.sql\` in an ephemeral PostgreSQL 18 database. No database connection string or account-level secrets are used.
- Only the CI outcome for the **exact final head SHA** can be recorded as a passed test. Database-level cross-session race tests and real concurrency/load behavior are not inferred from a single-session invariant suite; a separate two-connection stress test is required before production.
- Main workflow is unchanged, so the migration remains isolated in this PR until authorized.

## Deployment, rollback and incomplete items

**Deployment is prohibited at this point** without a separate owner's authorization and a reviewed rollback plan. If eventually applied to a test branch, validate schema and privilege inventory without reading private records. Before any live release, explicitly approve a separate Neon schema migration and safe rollback for queued events; do not drop active notification data.

For the current Draft PR, rollback simply means closing the unmerged branch. No live database change exists, hence no data deletion is necessary.

Still incomplete / **تأییدنشده**: live database schema inspection, approved runtime DB roles/permissions, multi-worker stress test, recipient binding and storage, exact event payload/channel semantics, data-provider publication rights, real user identity, actual Bale delivery, SLO, full live Worker integration, iOS browser outage root cause, and three truly independent reviewer approvals. **The schema may pass CI and yet not be production-ready.**
