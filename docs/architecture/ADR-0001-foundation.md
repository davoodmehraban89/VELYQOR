# ADR-0001: MVP Foundation Architecture

Status: Accepted
Date: 2026-10-05

## Context
VELYQOR must validate Iranian USD/gold charting and derived gold valuation quickly without creating an architecture that blocks future AI, community, additional markets, or trading capabilities.

## Decision
1. Start as a modular monolith plus independently schedulable ingestion workers.
2. PostgreSQL is the canonical application and market datastore.
3. Supabase is the preferred MVP PostgreSQL/Auth/Realtime platform, while domain/data contracts remain PostgreSQL-portable.
4. Cloudflare is used for edge delivery, caching, protection, and suitable worker workloads; D1/KV/Durable Objects do not replace the canonical PostgreSQL market store.
5. Market providers are isolated behind adapters.
6. Raw observations are retained separately from normalized ticks/candles.
7. Backend canonical timestamps are UTC; Iran-facing UI uses Asia/Tehran.
8. Derived values retain complete source provenance and calculation version.
9. TradingCursor, if used, is an external research/benchmark provider and never a production market-price source of truth.
10. AI cannot directly execute trades; a future trading layer requires independent risk/order controls.

## Consequences
This favors correctness, auditability, lower MVP operational complexity, and future extraction of genuinely high-load modules. It deliberately rejects premature microservices and provider-specific core logic.
