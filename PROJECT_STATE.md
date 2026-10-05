# VELYQOR Project State

Last updated: 2026-10-05

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
- Cloudflare is edge/runtime/cache/protection. Hyperdrive is configured only after a reachable PostgreSQL endpoint exists.
- Provider adapters feed immutable raw observations, normalization, quality gates, candle construction, and derived-series calculation.
- UTC canonical storage; Asia/Tehran presentation.
- No UI timeframe may imply precision not supported by observed source cadence.

## Completed
- Phase 0 foundation and provider-neutral PostgreSQL schema merged.
- Canonical instruments, raw observations, ticks, candles, derived values, quality events, workspaces and drawings schema defined.
- Deterministic theoretical 18K gold and premium calculations implemented.
- Timestamp alignment, staleness, provider normalization and provider health implemented.
- GOOD / DEGRADED / STALE / INVALID quality classification implemented.
- Provider-neutral ingestion and derived-gold pipeline implemented.
- Navasan adapters implemented for USD_IRT_FREE and GOLD18_IRT, including IRR→IRT normalization and historical daily OHLC parsing.
- Alpha Vantage XAU/USD spot adapter implemented.
- Data Proof metrics implemented for cadence, gaps, duplicates and out-of-order observations.
- Provider source matrix documented.
- Render Free PostgreSQL was tested and rejected because provisioning required payment credentials.

## In progress
- Deterministic multi-timeframe candle builder with no synthetic gap filling.
- Numeric quality scoring and propagation into candles/derived data.
- Live Data Proof for USD_IRT_FREE, GOLD18_IRT and XAU_USD.
- Managed PostgreSQL provisioning on a no-card free provider.
- Secondary legally usable Iranian source research for cross-check/failover.

## External blockers
1. No live VELYQOR PostgreSQL endpoint is connected, so production-like migration/invariant execution and Hyperdrive binding cannot yet be completed.
2. Live provider credentials are not connected to the runtime, so real cadence/quota/freshness measurements cannot yet be completed.

## Phase 1 exit gates
1. PostgreSQL migrations and invariants execute successfully against a live reachable PostgreSQL instance.
2. USD_IRT_FREE, GOLD18_IRT and XAU_USD each have a live tested ingestion path.
3. Observed cadence, latency, gaps, duplicates, out-of-order behavior and failure/recovery are recorded for each source.
4. Candle construction is deterministic and never invents missing observations.
5. Quality state/score propagates into candles and derived values.
6. At least one secondary legally usable reference is identified for Iranian market cross-check, or the lack of one is explicitly accepted as a launch risk.
7. Secrets are runtime-only and absent from the repository.
8. CI is green for all Phase 1 domain behavior.

## Risks
- Iranian market-data licensing, timestamp quality, anti-bot restrictions, history and reliability.
- Free source cadence may be insufficient for intraday timeframes; unsupported timeframes must stay disabled.
- Free database hosting is temporary infrastructure and must not become a product dependency.

## Next checkpoint
Finish all non-external Phase 1 gates, then execute live PostgreSQL and provider Data Proof immediately when runtime credentials/endpoints are available.
