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
