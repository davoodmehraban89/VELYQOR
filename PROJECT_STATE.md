# VELYQOR Project State

Last updated: 2026-10-07

## Current phase
Phase 1 — Market Data Integrity & Data Proof.

## Product scope locked for MVP
- Iran free-market USD/IRT
- Iran 18K gold/IRT market price
- Global XAU/USD
- Theoretical 18K gold/IRT
- Gold market premium/discount absolute and percentage series
- Professional charting, drawing tools, technical indicators, overlays, and persistent user workspaces

## Architecture baseline
- Modular monolith for MVP, with independently schedulable ingestion workers.
- TypeScript/React/Next.js web application.
- PostgreSQL is the canonical database contract; hosting is replaceable through `DATABASE_URL`.
- Neon is the current zero-cost Phase 1 PostgreSQL host; it is infrastructure, not a product dependency.
- Cloudflare is edge/runtime/cache/protection. Hyperdrive is configured only when justified by the deployment path.
- Provider adapters feed immutable raw observations, normalization, quality gates, candle construction, and derived-series calculation.
- UTC canonical storage; Asia/Tehran presentation.
- No UI timeframe may imply precision not supported by observed source cadence.

## Completed
- Phase 0 foundation and provider-neutral PostgreSQL schema merged.
- Canonical instruments, raw observations, ticks, candles, derived values, quality events, workspaces and drawings schema defined.
- Deterministic theoretical 18K gold and premium calculations implemented.
- Timestamp alignment, staleness, provider normalization and provider health implemented.
- Deterministic multi-timeframe candle builder implemented with no synthetic gap filling.
- Numeric quality scoring and propagation into candles/derived data implemented.
- GOOD / DEGRADED / STALE / INVALID quality classification implemented.
- Provider-neutral ingestion and derived-gold pipeline implemented.
- Navasan adapters implemented for USD_IRT_FREE and GOLD18_IRT, including IRR→IRT normalization and historical daily OHLC parsing.
- Alpha Vantage XAU/USD spot adapter implemented.
- Data Proof metrics and aggregate evidence artifact implemented for cadence, freshness, gaps, duplicates and out-of-order observations.
- Market calendar, price-spike detection, provider failure/recovery state machine and persistence hardening implemented.
- Provider source matrix documented, including unresolved domestic redundancy risk.
- PostgreSQL 18 persistence invariants execute successfully in CI.
- Reachable Neon PostgreSQL provisioned for VELYQOR.
- All three database migrations executed successfully against live Neon PostgreSQL.
- Both SQL invariant suites executed successfully against live Neon PostgreSQL.
- Live database proof recorded in `docs/data/phase1-live-postgres-proof.md`.
- Domain regression suite passes: 66/66 tests.

## In progress
- Live Data Proof for USD_IRT_FREE, GOLD18_IRT and XAU_USD.
- Secondary legally usable Iranian source research for cross-check/failover.

## External blockers
1. `NAVASAN_API_KEY` is not connected to the runtime, so live USD_IRT_FREE and GOLD18_IRT cadence/quota/freshness proof cannot yet execute.
2. `ALPHAVANTAGE_API_KEY` is not connected to the runtime, so live XAU_USD proof cannot yet execute.
3. Cloudflare Hyperdrive is not configured yet. The Cloudflare account currently has zero Hyperdrive configs, and creating one requires the live database credential to be entered through a secure channel without exposing it in repository history or chat.

## Phase 1 exit gates
1. PostgreSQL migrations and invariants execute successfully against a live reachable PostgreSQL instance. **PASS**
2. USD_IRT_FREE, GOLD18_IRT and XAU_USD each have a live tested ingestion path. **BLOCKED — provider credentials**
3. Observed cadence, latency, gaps, duplicates, out-of-order behavior and failure/recovery are recorded for each source. **BLOCKED — provider credentials**
4. Candle construction is deterministic and never invents missing observations. **PASS**
5. Quality state/score propagates into candles and derived values. **PASS**
6. At least one secondary legally usable reference is identified for Iranian market cross-check, or the lack of one is explicitly accepted as a launch risk. **PASS as documented unresolved launch risk**
7. Secrets are runtime-only and absent from the repository. **PASS**
8. CI is green for all Phase 1 domain behavior. **PASS**
9. Cloudflare Hyperdrive is configured against the reachable PostgreSQL endpoint. **BLOCKED — secure database credential handoff**

## Risks
- Iranian market-data licensing, timestamp quality, anti-bot restrictions, history and reliability.
- Free source cadence may be insufficient for intraday timeframes; unsupported timeframes must stay disabled.
- The current domestic-source stack does not yet have a second zero-cost legally usable failover source.
- Free database hosting is temporary infrastructure and must not become a product dependency.

## Next checkpoint
Securely connect the Navasan and Alpha Vantage runtime credentials and the Neon database credential to Cloudflare Hyperdrive without committing or exposing secrets; execute continuous live Data Proof for all three required instruments; record provider and Hyperdrive evidence; then close Phase 1 only if all external gates pass.

## Handoff update — 2026-10-11: ECB history and direct-Neon work
- **Verified in production Neon:** 762 licensed ECB EXR daily reference observations in `market_ticks`, 254 per EUR_USD_ECB/EUR_GBP_ECB/EUR_CHF_ECB, 2025-10-13 to 2026-10-09; 0 invalid/duplicate checks. The `candles` table remains empty. The 2026-10-11 importer `--commit` reported 0 *new* rows; do not attribute prior inserts to this run.
- **Verified deployed:** existing `/api/history` retrieves 254-row annual observations through Cloudflare KV and line-chart UI; live smoke also passed domestic, widget, and Scriptable routes. This is not yet a live PostgreSQL read.
- **Implemented in isolated GitHub branch, not deployed:** bounded/parameterized Neon-first API with KV fallback, 9 passing Worker history unit tests and syntax check.
- **Security blocker:** SQL-created `chartnova_history_ro` has read access exclusively to the ECB history view but is NOLOGIN awaiting secure credential activation. An API-created `chartnova_history_reader` unexpectedly inherited privileged `neon_superuser` membership and **must not be used**; deletion was completed and confirmed absent in pg_roles after user approval. Safe Cloudflare secret handoff was blocked, and `CHARTNOVA_HISTORY_DATABASE_URL` is absent.
- **Next checkpoint:** secure least-privilege role credential through approved dashboard, complete API+UI integration and live test on a reviewed Worker deployment, then continue seeking explicitly licensed OHLC sources. Details and rollback are in `docs/data/neon-history-direct-handoff-2026-10-11.md`.

## 2026-10-11 — Security cleanup verified
With explicit user approval, the unused overprivileged Neon role `chartnova_history_reader` was deleted. Independent queries confirm 0 remaining matches, `chartnova_history_ro` still present with read access only to the ECB view and `NOLOGIN`, and ECB history remains **762 observations (254 per symbol)**. No deployed Worker secret or application code was changed. Pre-delete role configuration and post-delete evidence: `docs/security/neon-history-reader-predelete-2026-10-11.md`.

## 2026-10-11 — OHLC license gate, secure historical API and chart provenance (isolated branch)
- Added `packages/market-domain/src/licensed-ohlc-history.mjs`: strict source-OHLC-only staging validation; explicit human-reviewed licensing metadata, commercial-storage/public-redistribution rights, exact base-ten IRR→IRT normalization for declared pairs, UTC offsets + IANA session zone, no invented volume/candles, duplicate and missing-session diagnostics, and strict annual-publication readiness gate. The gate verifies *claims* in a license manifest, not the authenticity of any signed agreement.
- Added regression tests `licensed-ohlc-history.test.mjs` and `licensed-ohlc-release.test.mjs`. Domain suite **85/85 PASS**.
- Tightened `GET /api/history` input (duplicates/empty dates), cached public-response allowlist, non-empty series gate. Added `deploy/chartnova/history-security.test.mjs`.
- Synced `deploy/chartnova/history-ui.js` into embedded Worker UI, removed hard-coded KV provenance, and added `history-ui-sync.test.mjs`. Worker/history **14/14 PASS**, Worker syntax PASS. None of these changes are deployed to Production.
- Independent read-only audit of user's uncommitted `db/migrations/0005_navasan_private_daily_ohlc.sql` found a **raw currency unit discrepancy**: the proposed SQL claims IRT, whereas committed Navasan adapter interprets IRR and divides by ten. Migration remains unexecuted and user's uncommitted files untouched. Must verify provider units and licensing before any import.
- Source guide from Navasan documents `ohlcSearch` but not definitive commercial redistribution terms. No Navasan/TGJU/OHLC records were written to Neon. `candles` remains 0 and licensed ECB remains 762 reference points.
- `chartnova_history_ro` remains a database NOLOGIN role; Worker has no direct Neon secret binding. Manual secure activation and live integration tests are required; only the existing KV-based reference chart is live.
- Evidence and remaining gates: `docs/data/ohlc-licensing-and-ingestion-gate.md`, `docs/data/neon-history-direct-handoff-2026-10-11.md`.

## 2026-10-11 — CI gate remains RED (independent verification)
- GitHub Actions run `38172295674` on PR #23 / head `7d0912e1e7777cea882ddc70e49d2f6d3932dc9f` was reported **completed / failure** in both jobs: `verify` and `postgres-invariants`. The workflow-job log downloads returned GitHub 404 `BlobNotFound` and step summaries were empty; the precise failure cause could not be verified.
- Local isolated-worktree results remain **85/85 domain** and **14/14 Worker/history** PASS, with Worker syntax PASS. These results **do not replace a green remote CI**.
- The connected Windows device has Corepack-managed `pnpm 10.17.1` but no standalone `pnpm` on PATH, so `corepack pnpm verify` stopped when its nested `pnpm` command was unavailable. The device has no available `psql` or `docker` CLI for locally reproducing the PostgreSQL CI job. Do not treat this as a proven application defect or green full verify.
- **Release gate:** keep PR #23 draft and do not merge/deploy on the strength of local tests; recover CI logs or reproducible runner diagnostics and resolve both jobs first. GitHub run: https://github.com/davoodmehraban89/VELYQOR/actions/runs/38172295674
