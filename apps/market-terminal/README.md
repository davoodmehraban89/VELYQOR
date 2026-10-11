# ChartNova standalone market terminal (staging scaffold)

This is a **runnable React + Vite + TradingView Lightweight Charts v5** frontend. It is not deployed to `app.chartnova.ir` and does not replace the existing Worker application.

## Local build

```bash
cd apps/market-terminal
npm ci
npm run dev
npm run build
```

Node.js 20+ is required. `npm ci` uses the committed `package-lock.json`; never commit `node_modules`, `dist`, provider keys, or PostgreSQL URLs.

The local Vite development server proxies `/api` to `https://app.chartnova.ir`. Current UI symbols are **EUR/USD, EUR/GBP and EUR/CHF ECB daily reference observations** only. The existing REST endpoint returns reference points, which render through `LineSeries`, **not fabricated candlesticks**. The `CandlestickSeries` codepath is present for genuinely licensed, validated source OHLC when the future provider-neutral REST handler is wired.

`VITE_MARKET_REST_BASE` can point to a trusted REST backend; leave it empty for same-origin API routing. Do not put a database secret in any `VITE_*` variable: all Vite variables are exposed to the browser bundle.

`VITE_MARKET_WS_BASE` is intentionally empty. After a vetted staging WebSocket deployment, use a **wss://** endpoint ending in `/stream`, for example `wss://<approved-host>/stream`. The client adds `?symbol=<canonicalSymbol>`, sends `stream.subscribe`, and accepts only validated `market.update` frames. WebSocket does **not** replace historical REST reconciliation after loss of connectivity.

## Required acceptance gates before production

- Written provider data rights, including public redistribution, storage, derived analytics, and attribution; an API key is not proof of rights.
- Verified real OHLC provider history, no synthetic candles or gap filling, canonical unit/quote side and timezone mapping, and market calendar quality checks.
- Secure Cloudflare `STREAM_INGEST_TOKEN` secret (32+ characters) and `STREAM_ROOMS` Durable Object binding. Origin/allowlist/WAF/rate limits, private publisher routing and potential DO billing must be reviewed. Template: `deploy/chartnova/wrangler.realtime.example.toml`.
- Live REST (read-only Neon history repository) and WSS staging end-to-end tests, reconnection, sequence gaps, staleness, backpressure, provider outages, security negatives, and rollback.
- CI must be green; local build success does not supersede failed GitHub Actions.

## Copyright / UI licensing

Lightweight Charts™ is a TradingView product. Keep the visible TradingView attribution/link in the frontend and include the project's NOTICE text in the final distributed package as required by its license: https://tradingview.github.io/lightweight-charts/docs/5.0

## Explicit limitations

This stage does not supply live Binance, CoinGecko, Polygon, Navasan or Bonbast feeds; none has been authorized, connected and validated for public commercial charting. The standalone `scripts/research-yfinance.py` is **personal/research only**, not an ingestion path into Neon or any public API.

The yfinance library license is separate from rights to Yahoo market data. Do not conflate them.
