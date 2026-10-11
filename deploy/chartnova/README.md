# ChartNova market terminal — Cloudflare Worker preview

This deployable module backs the ChartNova Cloudflare Worker preview, **not** the entire Next.js application. The existing Cloudflare script name is `velyqor-preview` for infrastructure compatibility.

## Delivered behavior

- `GET /api/markets`: validated `GHEYMAT` instruments, currently **58** symbols, with exact `BASE-QUOTE` identifiers and up to 168 source-provided hourly observations. Query `?symbol=USD-IRT` for one instrument.
- `GET /api/domestic`: Gheymat.online USD and 18k-gold sell quotes, automatically falling back to Oanor's cached observation and then to last-known valid prices.
- `GET /api/xau`: retains the original global-gold source.
- Searchable watchlist grouped by currencies, metals, coins and cryptocurrencies. Hourly **line charts** (not fictitious OHLC candlesticks). SMA20, SMA50, EMA20, Wilder RSI14, MACD(12,26,9) and calculated 24-hour change.
- Source timestamp and freshness are presented separately from the time when the Worker fetched the payload.

## Upstream quota and fallback

- Cron `*/15 * * * *`: fetches the full Gheymat catalog with **one upstream request** per run (nominally 96 requests/UTC day). Internal KV guard limits scheduled requests to 200 per day, below the upstream free allowance of 250/day.
- Cron `0 8 * * *`: retains Oanor once-daily backup for USD and 18k gold. Existing `OANOR_API_KEY` and `MARKET_CACHE` bindings must remain.
- The frontend reads Cloudflare KV; opening screens does not spend upstream quota.
- **Only USD and 18k gold** have a separately sourced fallback. The wider 58-symbol watchlist remains available from last-known cached values if Gheymat is down; it must display an aged-data notice. No fabricated historical prices.
- Last-known data is not equivalent to a real-time quote; no provider guarantees uninterrupted live prices.

## Tests

```sh
node --check deploy/chartnova/worker.mjs
node --test deploy/chartnova/market-terminal.test.mjs
npm test
```

The hosted Worker is updated via Cloudflare API, preserving existing KV namespace and secret bindings. The Worker contains embedded HTML/JS; `market-ui.js` is the corresponding readable UI implementation, and edits must be mirrored in the Worker before redeployment.

Independent headless Edge UI tests used actual cached-provider fixtures locally; neither fabricated prices nor browser fixtures were deployed.

## Multi-asset Home Screen Widget preparation (October 2026)

The browser interface now has a **ویجت گوشی** screen and a watchlist favorites toggle. Users can select up to 6 actual market instruments, reorder or remove them, and choose dark, light or Nova Glass appearance. Preview sizes show 2 / 4 / 6 rows. Each card shows the correct quote unit and source freshness, not a fabricated real-time price.

Favorites and widget preferences are stored in **browser localStorage** under `chartnova-widget-prefs-v1`. No user account, cross-device synchronization, or native widget installation is implemented at this stage.

`GET /api/widget?symbols=USD-IRT,GOLD18-IRT,BTC-USD` returns a small, read-only selection of cached symbols, keeping order. It includes prices, quote currencies, provider timestamps, percentage changes, `stale`, `missingSymbols` and `refreshAfterSeconds: 900`. Inputs are limited to 6 valid ticker IDs. This endpoint reads KV only and **does not consume upstream API quota**. It is suitable as a future native widget feed.

**Installability limitation:** A PWA home-screen shortcut is not equivalent to a native iOS WidgetKit or Android App Widget. Until native code is built, signed and installed for the selected platform, ChartNova will not appear under the system's Add Widget picker. Do not claim otherwise. Android/iOS background refresh scheduling is managed by the OS, not guaranteed to run every 15 minutes.

Tests:
```sh
node --test deploy/chartnova/widget-config.test.mjs
node --test deploy/chartnova/market-terminal.test.mjs
node --check deploy/chartnova/worker.mjs
```

## One-year historical reference rates (2026-10-11)

The historical storage pipeline is now seeded with **762 real ECB daily foreign-exchange reference observations** on the existing Neon PostgreSQL production branch:

- `EUR_USD_ECB`: 254 valid business-day observations (2025-10-13—2026-10-09).
- `EUR_GBP_ECB`: 254 observations.
- `EUR_CHF_ECB`: 254 observations.

Stored in `market_ticks` with provenance flags `daily_reference_point_not_ohlc`; new provider/instrument mappings plus unique source/time index and a restricted **public SELECT-only view** `chartnova_history_public`. The `candles` table remains empty; one point per day **cannot** be passed off as open/high/low/close. The official ECB data permits reuse with attribution.

A verified snapshot from the Neon public view has been **mirrored into Cloudflare KV** under keys `history:ecb:<SYMBOL>:1y`, then served by the new restricted `GET /api/history?symbol=EUR_USD_ECB` endpoint. Only the 3 allowlisted symbols are supported. The new historical page draws an actual daily line series and computes SMA/RSI/MACD over observations, labeled as derived from **reference rates, not traded candles**. It does not claim price forecasts.

**Operational limitation:** This is a verified one-time Neon-to-KV data sync, **not yet an automatic continuous DB synchronization pipeline**. A live PostgreSQL credential was intentionally **not** exposed to Cloudflare; the worker serves a validated public history cache. Run `node scripts/import-ecb-reference-history.mjs --commit` with local `DATABASE_URL` to import updated ECB data (idempotent). Updating the KV mirror requires a controlled export/sync; a scheduled cross-provider sync has not been configured.

**Local and live checks:** `node --test deploy/chartnova/history-endpoints.test.mjs`, `node --test deploy/chartnova/market-terminal.test.mjs deploy/chartnova/widget-config.test.mjs`, `npm test`. Confirm real API content and browser UI after Cloudflare deployment. The existing Scriptable V3/V4 file download routes have been preserved in `worker.mjs`.

Domestic free-market USD, 18K gold, and gold coin **do not yet have licensed one-year OHLC history**. TGJU public site has useful OHLC history but its terms restrict reuse without a written license. Those symbols must not be seeded from unlicensed or fabricated candlesticks. Cryptocurrency OHLC feeds also require reachable, licensed providers; initial Binance and Kraken probes failed on this network.
