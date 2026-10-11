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
