# ChartNova — API v2 ECB adapter & WebSocket resilience checkpoint

Date: 2026-10-12  
Development branch: `feature/chartnova-multimarket-chart-ws-foundation`  
Draft PR: https://github.com/davoodmehraban89/VELYQOR/pull/24

## Completed in source (NOT deployed)

- `packages/market-feed/src/neon-ecb-history.mjs`: read-only, query-parameterized and allowlisted ECB history adapter. Accepts only `EUR_USD_ECB`, `EUR_GBP_ECB`, `EUR_CHF_ECB`, 1-day `reference_point`, and a PostgreSQL URL for *exactly* `chartnova_history_ro` on an approved `*.neon.tech` host.
- SQL queries only `public.chartnova_history_public`; uses bounded `LIMIT`, two UTC date bounds and optional cursor. Validates exact ECB source, published series ID, observation_date, quality, price and licensing/attribution flags before providing public results. No OHLC inference or provider table-name interpolation.
- `deploy/chartnova/worker.mjs`: adds a gated `GET /api/v2/history` path using this server-only repository. With no `CHARTNOVA_HISTORY_DATABASE_URL` bound, it deliberately returns HTTP 503. Existing `GET /api/history` still supports the verified KV fallback and was regression-tested. The new route exists only in the **unmerged branch**, not in the deployed Worker.
- `deploy/chartnova/market-stream-worker.mjs`: closes slow WebSocket consumers whose buffered outgoing bytes exceed 1 MiB; normal subscribers remain unaffected and can reconcile missed events via REST on reconnect.
- New tests: `packages/market-feed/test/neon-ecb-history.test.mjs`, `packages/market-feed/test/websocket-room.test.mjs`, `deploy/chartnova/history-v2-worker.test.mjs`. All price numbers and credentials in these tests are clearly **fictional fixtures** and are never inserted into Neon.

## Verified actual state

- PostgreSQL direct SELECT: **762** ECB reference observations, **0** real OHLC candles, `chartnova_history_ro` present but **NOLOGIN**, former `chartnova_history_reader` absent.
- Deployed Cloudflare `velyqor-preview` binding names remain `MARKET_CACHE`, `NAVASAN_API_KEY`, `OANOR_API_KEY`. No Neon history URL or Durable Object secret/binding was installed.
- Isolated Windows worktree: **126 / 126** domain+market-feed tests PASS, **18 / 18** Worker/history tests PASS, both Worker syntax checks PASS and standalone React + Lightweight Charts Vite production build PASS.
- Original working tree's uncommitted files and untracked `0005_navasan_private_daily_ohlc.sql` remained untouched.

## Unresolved release gates

1. Actual authorized credential setup for restricted Neon role, through Neon and Cloudflare secret managers. No database secret can be committed to GitHub or placed in Vite client environment. A real Worker↔Neon HTTP SQL call is **still not verified**.
2. **CI red:** GitHub Actions run `38197941929`, run #93, both `verify` and `postgres-invariants` failed. Both GitHub job log API requests failed with `404 BlobNotFound`; root cause **not established**. These unresolved jobs block merging and production release. https://github.com/davoodmehraban89/VELYQOR/actions/runs/38197941929
3. Licensed OHLC archives (Iran markets, cryptocurrencies, forex, equity indices and XAU) are **not** ingested. The ECB data cannot serve as candlestick candles.
4. WebSocket Durable Object staging and provider publisher are **not** deployed; no WebSocket real-time latency or browser reconnection test has been performed. Deployment/billing and provider rights still require authorization.
5. Navasan unit conflict (local proposed migration IRT vs adapter IRR) must be verified against original provider contract/payload before running any migration.
6. Modeling/prediction and backtests need genuine source candles, temporal holdout, no lookahead and quality audits before user-facing forecast claims.

## Safe rollback

No production changes were made. To discard this v2 experiment, revert just its commits in the feature branch. Live `/api/history`, KV, Neon data and current Worker remain in place. Do not activate the optional secret or DO route until CI and explicit security/deployment gates are passed.
