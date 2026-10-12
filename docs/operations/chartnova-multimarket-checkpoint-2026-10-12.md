# ChartNova multi-market foundation — implementation checkpoint

**Date:** 2026-10-12  
**Branch:** `feature/chartnova-multimarket-chart-ws-foundation`  
**Pull request:** https://github.com/davoodmehraban89/VELYQOR/pull/24 (draft; based on draft PR #23)  
**Status:** Runnable development scaffold and local tests pass; **not deployed, not data-provider integrated**.

## Implemented in this branch

- Standalone `apps/market-terminal` React + Vite market terminal with TradingView Lightweight Charts v5 Canvas; production JS/CSS output builds. Current verified ECB reference history uses a **line**, not a fictional candlestick. Licensed source OHLC route uses CandlestickSeries when a compliant backend is connected. Visible TradingView attribution remains.
- `packages/market-feed/src/contracts.mjs`: provider-neutral records with explicit symbol, unit, source, source/receive timestamps, quality, rights and provenance; no public publish for research-only or invalid data.
- `packages/market-feed/src/adapters.mjs` and `providers.mjs`: CoinGecko market-chart point normalization, bounded historical request planning, Binance venue-specific genuine kline parsing, optional yfinance research-only bridge, explicit pending Polygon/Navasan/Bonbast capabilities. No provider data were fetched or imported here.
- `packages/market-feed/src/history-api.mjs`: unmounted, bounded `GET /api/v2/history` repository port requiring licensed data and a read-only persistence adapter. Metadata now reports `rights: approved_public` only after backend rights gate passes. Web frontend adapter supports both the currently live legacy ECB REST schema and future provider-neutral REST schema (hourly timestamps, daily session dates and actual source OHLC).
- Selected WSS protocol: `deploy/chartnova/market-stream-worker.mjs` and `deploy/chartnova/wrangler.realtime.example.toml` — one Durable Object per symbol; public read subscriptions, private authenticated publisher, allowlist/Origin checks, payload bound, capped sockets, persisted monotonic sequence. React UI uses `/stream?symbol=...` and `stream.subscribe`. `realtime-gateway.mjs` is an alternative un-deployed design, **not** the frontend target. No DO or paid Cloudflare resources created.
- `apps/market-terminal/package-lock.json` enables deterministic `npm ci`. `apps/market-terminal/README.md`, ADR-0004 and provider matrix document limitations. Existing Windows user's modified worktree and untracked Navasan migration were not edited.

## Independent local verification

From a clean isolated Git worktree on the authorized device:

- `npm test`: **117/117 PASS** (existing market domain + new feed/gateway + REST→chart integration).
- `node --check deploy/chartnova/market-stream-worker.mjs`: **PASS**.
- `cd apps/market-terminal && npm ci --no-audit --no-fund && npm run build`: **PASS** (Vite 6.4.4; 35 modules transformed; JS bundle generated).
- Earlier isolated reusable `packages/chart-ui` TypeScript check was reported as PASS in the prior branch checkpoint; this is not a browser E2E proof.
- yfinance research Python CLI was added, but **Python is unavailable on the Windows device**. Its actual runtime/yfinance interaction is **not tested**.
- GitHub Actions for PR #24 were previously **RED**. CI logs were not retrievable via the connected GitHub API (BlobNotFound); keep PR draft and do not describe it as green.
- No real staging WebSocket upgraded, no provider subscription or publisher connected, no live REST→licensed-Neon integration/latency measurements completed.

## Production invariants (last directly verified)
- Neon: 762 ECB reference points; `candles` count = 0.
- Restricted role `chartnova_history_ro` remains, currently `NOLOGIN`.
- Removed privileged role `chartnova_history_reader` remains absent.
- Live `velyqor-preview` Worker binding names: `MARKET_CACHE`, `NAVASAN_API_KEY`, `OANOR_API_KEY`; **no** `CHARTNOVA_HISTORY_DATABASE_URL` or WebSocket Durable Object binding.
- No production website deployment occurred.

## External prerequisites, prioritized

1. **Licensing and price semantics:** documented rights to query/store/display/commercially redistribute provider data, per market and quote side. Confirm Navasan IRR vs IRT and per-gram vs mesghal; written Bonbast/Poylgon terms and endpoint specifications. yfinance is research-only unless separate Yahoo data rights are obtained.
2. **Provider entitlements/credentials:** approved server-only keys for CoinGecko and Navasan/Bonbast/Polygon as applicable; verify Demo quota and actual 365d hourly retrieval rather than assuming it; Binance region/API reachability (prior 451). Do not put keys in Vite env or GitHub.
3. **Secure read-only history:** administrator-assisted scoped Neon reader credential through secret manager, schema view and authorized actual OHLC persistence pipeline; independently verify one-year date coverage and source provenance.
4. **Cloudflare staging and spend:** choose approved hostname/route, Cloudflare DO/billing authorization, `STREAM_INGEST_TOKEN` secret, origin/rate limits and WAF/Access. Deploy *staging* before production, instrument latency/connection counts/provider outages and rollback.
5. **Market requirements:** confirm initial requested symbols/markets and timeframe/quote-side resolution for crypto, Forex, equities, Iran. Decide true live latency and allowed free/paid quotas.
6. **Release gates:** live E2E API and WebSocket tests (plus gaps/reconnect/backpressure), clean browser UI, quality/indicators/backtest no-lookahead, green GitHub CI and explicit release approval.

## Restore / rollback
This branch is additive and isolated. Existing `velyqor-preview` serves today's deployed ECB/KV and domestic/widget API paths. No production rollback action is needed because no production configuration was changed. Do not merge PR #24 ahead of PR #23's security/CI resolution.
