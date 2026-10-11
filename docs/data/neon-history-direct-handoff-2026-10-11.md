# ChartNova — Neon direct-history handoff (2026-10-11)

## Verified operational evidence
- PostgreSQL project `still-shadow-40990313`, branch `production`, database `neondb`.
- `market_ticks` contains **762** ECB daily EUR reference observations (254 each for EUR/USD, EUR/GBP, EUR/CHF), 2025-10-13 through 2026-10-09, with **zero** invalid provenance checks and no duplicate `(symbol,observation_at)` pairs. `candles` remains empty by design; ECB daily reference points are not OHLC.
- The importer dry run parsed 762 valid observations with zero source duplicates. The subsequent `--commit` run reported `insertedThisRun: 0` while the database verified 762 rows. **Do not claim 762 newly inserted by this run**; they already existed by the time the committed import ran. The record insertion timestamp was not established.
- On deployed `app.chartnova.ir`, historical ECB endpoints and the history navigation, domestic prices, widget feed, and Scriptable V4 downloads passed direct smoke checks. Deployed history reads a Neon-verified KV mirror, **not a live direct database connection**.

## Isolated implementation
- Branch: `feature/chartnova-neon-direct-history`, forked from existing `feature/chartnova-neon-history`. The original Windows working tree had unrelated dirty edits; they were **not touched**.
- Updated `deploy/chartnova/worker.mjs` to accept `symbol` in the three-symbol ECB allowlist, `from`/`to` UTC ISO dates (no more than 400 days, not in the future), and `limit` 1–500.
- When the optional `CHARTNOVA_HISTORY_DATABASE_URL` Cloudflare secret exists, Worker sends parameterized SELECT queries to `public.chartnova_history_public` through Neon HTTP SQL. Worker stores a short-lived read result in existing `MARKET_CACHE`. The frontend receives only allowlisted historical rates and attribution, never the credential.
- When direct Neon is unavailable or unconfigured, the existing KV historical snapshot remains a labeled fallback. No user-selectable table name or SQL is exposed.
- `deploy/chartnova/history-direct.test.mjs` uses **test fixtures only** for shape, validation, and error handling. It does not demonstrate live direct-DB connectivity.

## Security handoff
- A least-privilege PostgreSQL role `chartnova_history_ro` was created by SQL with `NOLOGIN`, `NOINHERIT`, `NOCREATEDB`, and `NOCREATEROLE`. Permission checks prove it can SELECT only `public.chartnova_history_public`, not `market_ticks`, `candles`, or `instruments`, and cannot INSERT into `market_ticks`.
- The Neon role-creation API also created `chartnova_history_reader`, but unexpectedly granted membership in `neon_superuser` and role/database creation privileges. Attempts to harden it using the project-owner connection were denied. **This role was subsequently deleted after explicit user approval, verified absent from pg_roles; see docs/security/neon-history-reader-predelete-2026-10-11.md.**
- Secret transfer to Cloudflare was blocked by the execution environment's safety controls. The least-privilege role remains `NOLOGIN`, and `CHARTNOVA_HISTORY_DATABASE_URL` is **not configured**. Do not imply a deployed Neon direct connection.
- **Manual secure activation later:** use the Neon Console / SQL editor under an administrator authorized to manage the role: set a strong private password and LOGIN on `chartnova_history_ro`; set a Cloudflare Worker secret named `CHARTNOVA_HISTORY_DATABASE_URL` to a PostgreSQL URL for that role using Cloudflare's secure secret manager, not source code, chat, or ordinary worker variables. Then deploy the reviewed Worker branch and run real HTTP tests, including revoking SELECT to demonstrate fail-closed behavior.
- No licensed one-year OHLC feed for domestic free-market USD, Iranian 18K gold or coins has been connected. Never fill `candles` from ECB reference points, point-in-time KV snapshots, or unlicensed TGJU archives.

## Tests and remaining acceptance
- Isolated Worker: 9 / 9 `history-direct.test.mjs` + existing history-endpoints tests passed; `node --check` passed.
- Existing deployed version: history (all 3), page navigation, widget view, domestic price, widget API, and Scriptable V4 download passed.
- **Blocked:** direct Worker→Neon authenticated read (the secret binding is not configured), true continuous synchronization, production deployment of new code, live integration test using restricted DB role, licensed OHLC history for required markets, model backtesting and bias measurement.
- Production changes must not be declared done until least-privilege credential activation, checked runtime responses, negative security tests, and fallback regression smoke pass.

## Rollback
- Keep existing KV keys `history:ecb:<SYMBOL>:1y`; removing the optional database secret forces KV-only reads.
- Preserve existing published Cloudflare Worker version and version ID for rollback. Do not delete the existing KV namespace or provider secrets.

### Security cleanup completed
After explicit approval, the overprivileged `chartnova_history_reader` was deleted. A separate PostgreSQL verification returned zero matching role records, retained `chartnova_history_ro` with restricted permissions, and retained all 762 ECB observations. Safe secret handoff and live Neon-backed Worker deployment remain pending.
