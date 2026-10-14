# VELYQOR Project State

Last updated: 2026-10-07

Last checked (GitHub-only): 2026-10-14

> **IMPORTANT — review-branch status overlay (not yet merged into main).** The detailed sections below preserve the 2026-10-07 Phase-1 baseline. Its claims about disconnected provider keys and CI do **not** reflect a 2026-10-14 live runtime revalidation. Cloudflare previously exposed a `NAVASAN_API_KEY` secret name (not a verified end-to-end data proof); the current connected secret values were not read.

## Current safety checkpoint — 2026-10-14

- Working source of truth remains `main` at `29a45cff094658c7a2722fa6fa712bef061abb8c` until explicitly merged; review branch: `safety/p0-triage-2026-10-13`.
- Open PRs [#21](https://github.com/davoodmehraban89/VELYQOR/pull/21), [#22](https://github.com/davoodmehraban89/VELYQOR/pull/22), [#23](https://github.com/davoodmehraban89/VELYQOR/pull/23), [#24](https://github.com/davoodmehraban89/VELYQOR/pull/24), [#25](https://github.com/davoodmehraban89/VELYQOR/pull/25), and [#26](https://github.com/davoodmehraban89/VELYQOR/pull/26). PR #23 is based on the history feature branch; PR #24 is based on #23. PR #25 and #26 are isolated reviews from `main`.
- GitHub CI: #21, #22, #23 succeeded on second attempts 2026-10-14; #24 succeeded on its latest verified attempt 2026-10-12; #25 and #26 succeeded on 2026-10-14. A green CI does **not** establish data licensing, provider uptime, a real production Neon→Worker connection, or deployed streaming.
- **P0 PROTECT:** last verified Windows evidence included 9 tracked modifications, 1085 untracked paths and 5 worktrees. Desktop Commander was offline on 2026-10-14. No cleaning, overwriting or migration applied.
- **P0 BLOCK_IMPORT:** untracked `db/migrations/0005_navasan_private_daily_ohlc.sql` conflicts with existing adapter IRR→IRT assumptions. No import or migration before source-confirmed units/quote side, rights and reviewed dry-run.
- **P0 BLOCK_REDISTRIBUTION:** commercial source-OHLC storage and public redistribution rights remain unverified. ECB observations are reference points, not OHLC candles.
- **P0 NO_LIVE_ORDERS:** AI/signals cannot place live orders; independent order/risk controls and separate approval are required before any trading layer.
- Next actions: review independent #21/#22/#25/#26 for prospective merges; preserve #23/#24 as Draft until dependency, license, Neon reader, staging and end-to-end gates pass; verify Windows and provider documentation when available.
- Auditable details and ownership: [P0 triage](docs/security/P0_TRIAGE_2026-10-12_FA.md), [release safety gates](docs/security/P0_RELEASE_GATES.md), [PR readiness](docs/security/PR_READINESS_2026-10-14_FA.md).
- **Status of this checkpoint:** documentation and CI pass on review branches; **no merge to `main`, no operational deployment, no credential changes, no trade**.

---

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
