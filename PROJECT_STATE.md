# VELYQOR Project State

Last updated: 2026-10-05

## Current phase
Phase 0 — Foundation & Governance

## Product scope locked for MVP
- Iran free-market USD/IRT
- Iran 18K gold/IRT market price
- Global XAU/USD
- Theoretical 18K gold/IRT
- Gold market premium/discount absolute and percentage series
- Professional charting, drawing tools, technical indicators, overlays, and persistent user workspaces

## Architecture baseline
- Modular monolith for the MVP.
- TypeScript/React/Next.js web application; exact package versions are pinned when implementation begins.
- PostgreSQL as canonical datastore; Supabase is the preferred MVP PostgreSQL/Auth/Realtime platform, pending project connection.
- Cloudflare as edge/runtime/cache/protection layer, not the primary database.
- Provider adapters feed immutable raw observations, normalization, quality gates, candle construction, and derived-series calculation.
- UTC canonical storage; Asia/Tehran presentation.

## Connection priority
P0: GitHub, Context7, PostgreSQL/Supabase, Cloudflare.
P1: Figma, Notion.
P2: TradingCursor (benchmark/research only), Gmail, Railway/Render if a demonstrated need appears.

## Completed
- Independent private GitHub repository created: `davoodmehraban89/VELYQOR`.
- Initial `main` branch established by owner.
- Foundation branch created: `foundation/phase-0`.
- Product README normalized.
- Engineering/agent operating rules added.
- Next.js current documentation checked through Context7; current v16 documentation requires Node.js >=20.9 and supports TypeScript/App Router defaults.

## In progress
- Architecture Decision Records.
- Canonical instrument/unit/time contracts.
- Repository skeleton and CI baseline.
- Supabase/PostgreSQL connection.
- Cloudflare environment connection.
- Phase 1 provider research and data proof.

## Blockers / external actions
- Supabase project for VELYQOR is not yet identified/connected.
- Cloudflare application/environment for VELYQOR is not yet identified/connected.
- Figma and Notion project spaces are not required to start data proof, but are pending for P1.

## Risks
- Iranian market-data providers may have licensing, timestamp-quality, anti-bot, history, or reliability limitations.
- UI timeframe availability must be constrained by actual observation frequency; synthetic precision is prohibited.
- XAU/USD and USD/IRT source timestamps require explicit alignment and staleness thresholds for theoretical gold.

## Next checkpoint
1. Commit initial ADRs and data contracts.
2. Establish minimal TypeScript/Next.js repository skeleton and CI.
3. Connect/create PostgreSQL/Supabase resources.
4. Begin provider research and implement the first raw-ingestion proof only after provider/legal/technical suitability is documented.
