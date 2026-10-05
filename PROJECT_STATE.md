# VELYQOR Project State

Last updated: 2026-10-05

## Current phase
Phase 1 — Market Domain & Data Proof started. Phase 0 PostgreSQL foundation is merged.

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
- PostgreSQL is the only canonical database contract. Hosting provider is replaceable through `DATABASE_URL`.
- Initial hosting target is Aiven Free PostgreSQL if it can be provisioned without payment credentials; Aiven is infrastructure only, never a domain dependency.
- Supabase, Neon, Render and Railway are not architectural dependencies. They remain replaceable hosting alternatives.
- Cloudflare is edge/runtime/cache/protection. Hyperdrive can front any compatible reachable PostgreSQL once credentials exist.
- Provider adapters feed immutable raw observations, normalization, quality gates, candle construction, and derived-series calculation.
- UTC canonical storage; Asia/Tehran presentation.
- No UI timeframe may imply precision not supported by source data.

## Completed
- Independent private GitHub repository established.
- Phase 0 foundation merged to `main` with green CI.
- Provider-neutral PostgreSQL market core merged to `main` with green CI.
- Engineering rules, Definition of Done, architecture baseline and canonical market contracts established.
- PostgreSQL migrations exist for instruments, providers, raw observations, normalized ticks, candles, derived values, data-quality events, users, workspaces and drawings.
- Six canonical MVP instruments are seeded.
- Database invariant test exists for canonical instruments and invalid OHLC rejection.
- Cloudflare account connection verified.
- Render Free PostgreSQL was tested and rejected for the current zero-cost constraint because provisioning required payment credentials.
- Deterministic theoretical 18K gold and premium calculations implemented.
- Source timestamp alignment and staleness semantics implemented.
- Provider normalization contract implemented, including IRR-to-IRT conversion and refusal to guess unsupported units.
- Provider health contract implemented.
- Deterministic market-data quality classification implemented for GOOD / DEGRADED / STALE / INVALID.
- CI floating-point assertion defect was identified from workflow logs and corrected with tolerance-based numeric assertions.

## In progress
- Phase 1 provider research/data proof for USD/IRT, GOLD18/IRT and XAU/USD.
- Managed PostgreSQL provisioning on a no-card free provider.
- Provider-specific adapters only after legal/technical source suitability is documented.
- Integration of quality state with ingestion/candle pipeline.

## External blocker
A live VELYQOR PostgreSQL endpoint is not yet connected. This blocks executing migrations against production-like infrastructure, but it does not block domain implementation, deterministic tests, provider research, or application scaffolding.

## Risks
- Iranian market-data provider licensing, timestamp quality, anti-bot restrictions, history and reliability.
- UI timeframes must reflect actual observation frequency; synthetic precision is prohibited.
- XAU/USD and USD/IRT source timestamps require explicit alignment/staleness thresholds.
- Free database hosting is temporary infrastructure and must not become a product dependency.

## Next checkpoint
1. Get Phase 1 domain/provider contract CI green and merge.
2. Complete provider source matrix and select primary/secondary candidates for each canonical symbol.
3. Connect Aiven or another no-card PostgreSQL endpoint and execute migrations/invariants.
4. Configure Cloudflare Hyperdrive only after a real PostgreSQL endpoint exists.
5. Start chart application shell after Data Proof gates are satisfied.
