# VELYQOR Project State

Last updated: 2026-10-05

## Current phase
Phase 0 — Foundation & Governance; PostgreSQL core implementation in progress.

## Product scope locked for MVP
- Iran free-market USD/IRT
- Iran 18K gold/IRT market price
- Global XAU/USD
- Theoretical 18K gold/IRT
- Gold market premium/discount absolute and percentage series
- Professional charting, drawing tools, technical indicators, overlays, and persistent user workspaces

## Architecture baseline
- Modular monolith for the MVP.
- TypeScript/React/Next.js web application.
- PostgreSQL is the canonical datastore; hosting is provider-portable through `DATABASE_URL`.
- Neon is the preferred initial managed PostgreSQL provider, but is not a domain dependency.
- Cloudflare is edge/runtime/cache/protection; Hyperdrive may front PostgreSQL after credentials exist.
- Provider adapters feed immutable raw observations, normalization, quality gates, candle construction, and derived-series calculation.
- UTC canonical storage; Asia/Tehran presentation.

## Completed
- Independent private GitHub repository established.
- Phase 0 foundation PR passed CI and was merged to `main`.
- Engineering rules, Definition of Done, architecture baseline and canonical market contracts established.
- PostgreSQL portability decision recorded in ADR-0002.
- Initial PostgreSQL migrations created for instruments, providers, raw observations, normalized ticks, candles, derived values, data-quality events, users, workspaces and drawings.
- Six canonical MVP instruments are seeded.
- Database invariant test added for canonical instruments and invalid OHLC rejection.
- Cloudflare account connection verified; Hyperdrive API is available and currently has no configurations.
- Neon plugin is installed in the ChatGPT environment, but its operational actions are not exposed in this conversation yet.

## In progress
- Provisioning a managed PostgreSQL database for VELYQOR.
- Applying and executing database migrations/invariant tests against a real PostgreSQL instance.
- Cloudflare Hyperdrive configuration after PostgreSQL credentials exist.
- Phase 1 provider research/data proof.

## External blocker
A live PostgreSQL instance has not yet been provisioned/connected in this conversation. Until a database connection is available, migrations cannot truthfully be reported as executed. Neon is the selected initial provider; the schema itself remains portable PostgreSQL.

## Risks
- Iranian market-data provider licensing, timestamp quality, anti-bot restrictions, history and reliability.
- UI timeframes must reflect actual observation frequency; synthetic precision is prohibited.
- XAU/USD and USD/IRT source timestamps require explicit alignment/staleness thresholds.

## Next checkpoint
1. Provision/connect VELYQOR PostgreSQL.
2. Execute migrations and invariant tests.
3. Create Cloudflare Hyperdrive against the database.
4. Start Phase 1 provider adapters and data-quality proof.
