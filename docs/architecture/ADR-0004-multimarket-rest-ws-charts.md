# ADR-0004 — ChartNova multi-market REST + WebSocket + Lightweight Charts

**Date:** 2026-10-12  
**Status:** Accepted as architecture/scaffold; implementation and release gates still open.

## 1. Intent and compatibility

Keep the existing modular-monolith market domain, Neon PostgreSQL schema, ECB daily-rate archive, Cloudflare Worker/KV fallback, domestic prices, watchlists and widgets. Do not rebuild the working service. The user's original Windows working tree contains modifications, including an untracked `db/migrations/0005_navasan_private_daily_ohlc.sql`; they were not edited or executed.

This branch is based on `feature/chartnova-neon-direct-history`; it is separate from the production `main` line and currently has **no production deployment**.

## 2. Chosen boundaries

```text
User React frontend (client only)
 ├── Lightweight Charts v5 Canvas
 │    ├── source_ohlc → CandlestickSeries
 │    └── daily_reference_point_not_ohlc / reference_point → LineSeries
 ├── HTTPS GET /api/v2/history?... → server REST contract / license gate
 └── WSS /stream?symbol=... → Cloudflare Worker gateway → per-symbol Durable Object (hibernation)
                                   ↑ privately authenticated publisher
Source adapters / ingestion scheduler
 ├── CoinGecko market_chart (price points, not OHLC)
 ├── Binance spot klines (exchange-specific source OHLC; access gating)
 ├── yfinance (offline research-only bridge; never public production)
 ├── Polygon.io (future provider WebSocket subscription, plan-dependent)
 ├── Navasan (existing adapter; unit and redisplay authorization audit)
 └── Bonbast (future adapter blocked pending API/license evidence)
                     ↓ normalizers, raw immutable evidence, license contract, quality gates
           Neon PostgreSQL (canonical raw observations, ticks, OHLC, provenance)
                     ↓
                  KV (cache only)
```

**Provider adapters never decide final canonical symbol or market unit by guessing.** Mappings are explicit. Quote side (bid/ask/sell/reference/trade), instrument/venue, data time, receive time, quality status and rights are mandatory. Provider prices shall be stored as exact decimals in PostgreSQL, not rounded by rendering code.

**REST** is for bounded, indexed historical queries (ISO dates, 1h/1d, max 400-day window, <=5000 records/page, cursor). Never query upstream on each UI request. Neon reader restricted to history view; database URL only in secure server runtime. `serveHistoryV2` is an unmounted repository-port scaffold; when lookup is absent, it returns HTTP 503.

**WebSocket** is for low-latency incremental licensed events, not historical backfill. Proposed Cloudflare Durable Objects Hibernation gateway supports subscription validation, per-channel monotonic sequence, reconnection and gap detection. History replay on reconnect comes from REST. Publisher is authenticated by a private 32+ character token and rejected if rights are not `approved_public`. No provider publishers are active yet.

**Canvas**: `apps/market-terminal/src/main.jsx` is the runnable standalone React/Vite client using Lightweight Charts version 5 with `chart.addSeries(CandlestickSeries|LineSeries)`; `packages/chart-ui/src/LightweightMarketChart.tsx` remains a reusable component prototype. It does not turn ECB, CoinGecko, or other sampled points into fake OHLC. All public pages must include TradingView NOTICE and link.

## 3. Canonical API design

- Request: `GET /api/v2/history?symbol=BTC_USD&dataKind=source_ohlc&timeframe=1h&from=2025-10-12&to=2026-10-12&limit=1000&cursor=...`
- Response: `ok`, `symbol`, `source`, `attribution`, `unit`, `dataKind`, `timeframe`, `series[]`, `page.hasMore`, `page.nextCursor`, `delayed`.
- In `source_ohlc`, each returned observation is a real provider bar (`open/high/low/close`; source volume only when supplied), not a resampled single price.
- In `reference_point`, each observation contains only `time/price/quality`. Reference daily ECB remains distinct in the existing `/api/history` endpoint.
- Query fails closed if provider rights are not independently approved; raw payloads, keys and user credentials are never returned.

## 4. Commercial and operational security gates

No historical OHLC or predictions can be marked complete without:
1. Written terms/license confirming retrieval, storage, commercial redistribution, display, attribution, and derived analytics, separately for each provider and asset class.
2. A verified provider response from a reachable licensed endpoint, with a deterministic rate limiter and circuit breaker.
3. The existing `chartnova_history_ro` role securely activated (not `neondb_owner`); role remains NOLOGIN until credential handoff is approved. Never place DATABASE_URL, API keys or tokens in Git.
4. Provider-unit mapping, quote side, timezone/session calendar, duplicate and gap QC, source mutation policy, provenance and correct OHLC semantics.
5. Integration tests for actual REST→DB and WebSocket→client sequences, stale data, backpressure, reconnection and recovery; zero fabricated data.
6. A runnable React host application, documented deployment target, protected Cloudflare DO binding and safe rollback.
7. Successful CI and explicit deployment approval. Existing PR #23 had RED GitHub Actions checks, so local tests do not imply deployability.

## 5. Initial implementation files

```text
packages/market-feed/src/contracts.mjs
packages/market-feed/src/adapters.mjs
packages/market-feed/src/realtime-protocol.mjs
packages/market-feed/src/history-api.mjs
packages/market-feed/test/*.test.mjs
packages/chart-ui/package.json
packages/chart-ui/tsconfig.json
packages/chart-ui/src/LightweightMarketChart.tsx
deploy/chartnova/market-stream-worker.mjs
docs/architecture/ADR-0004-multimarket-rest-ws-charts.md
docs/data/multimarket-provider-matrix.md
```

**Important:** a standalone Vite/React app exists at `apps/market-terminal` and has passed a local production build, but it has **not** been mounted into or deployed over the existing production ChartNova app. No Durable Object was created, no live WebSocket opened and no backfill of unlicensed data was executed.

## 6. Resolution of competing scaffolds (implementation detail)
Two isolated WebSocket gateway sketches were prototyped while the architecture was being developed. To avoid sending a browser a protocol that its gateway cannot understand, **only** `deploy/chartnova/market-stream-worker.mjs` with `deploy/chartnova/wrangler.realtime.example.toml` is the selected deployment candidate. It uses `/stream?symbol=<CANONICAL_SYMBOL>`, per-symbol `SymbolStreamRoom`, server-side `STREAM_INGEST_TOKEN`, `STREAM_SYMBOL_ALLOWLIST`, and version-1 client `stream.subscribe` messages.

`deploy/chartnova/realtime-gateway.mjs` and `packages/market-feed/src/realtime-protocol.mjs` remain non-deployed alternative prototypes; do not point the React frontend at the `/ws/market` interface without deliberately migrating and re-testing the protocol. Neither approach has an active provider publisher or a live production route.

For historical data, the current standalone chart loads the **existing** ECB-only `/api/history` REST endpoint and renders those points as a line. `serveHistoryV2` is a provider-neutral and unmounted port for future licensed OHLC. It returns 503 without a configured repository; real candle display remains disabled until a licensed and independently validated data source, persistence and production REST integration exist.
