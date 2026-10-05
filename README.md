# VELYQOR

**Iran Market Intelligence, Advanced Charting & Trading Platform**

VELYQOR is a market-intelligence platform focused first on Iranian free-market USD and domestic 18K gold, connected to global XAU/USD data and derived valuation analytics.

## MVP

- `USD_IRT_FREE` — Iran free-market USD/IRT
- `GOLD18_IRT` — Iran 18K gold market price
- `XAU_USD` — global gold spot price
- `GOLD18_THEORETICAL_IRT` — theoretical 18K gold value derived from XAU/USD × USD/IRT
- `GOLD18_PREMIUM_IRT` and `GOLD18_PREMIUM_PCT` — market premium/discount
- Professional charting, drawings, indicators, comparison overlays, and persistent workspaces

## Engineering principles

- PostgreSQL is the market-data source of truth.
- Raw provider observations are retained for auditability.
- All normalized backend timestamps are UTC; Iran-facing presentation uses `Asia/Tehran`.
- Derived prices retain source provenance and calculation version.
- Provider-specific behavior stays behind adapters.
- AI is not a market-price source and cannot directly execute orders.
- The MVP begins as a modular monolith; services are extracted only when evidence requires it.

## Current phase

**Phase 0 — Foundation & Governance**

See `PROJECT_STATE.md` and `docs/architecture/` for the current execution state and architecture decisions.
