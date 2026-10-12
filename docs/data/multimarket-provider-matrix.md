# ChartNova provider integration matrix — 2026-10-12

This file records **technical candidates**, not verified production entitlements. The project is commercial; API availability, free plan and a source's publication license are separate questions.

| Market | Candidate | Historical feed | Live feed | Current readiness | Launch blocker |
|---|---|---|---|---|---|
| Crypto | CoinGecko Demo | `coins/{id}/market_chart[/range]` **price/time points** | REST polling; not a guaranteed tick WebSocket | Adapter and <=100 day hourly-window planner present; **no live import** | Verify Demo plan's accessible lookback, rate cap and commercial use/redistribution |
| Crypto | Binance Spot | `api/v3/klines` source OHLC, 1h/1d | Binance kline/trade WebSocket candidate | Pure kline adapter implemented; previous access attempts returned HTTP 451 from this environment | Jurisdiction/provider access, terms, mapping, rate cap, feed failover |
| Global FX, stocks, XAU | yfinance/Yahoo | OHLC historical data via Python for **research only** | Not an authorized live data feed for public app | Research-only adapter; no Yahoo scraping or redisplay in deployed app | Yahoo data terms warn of personal use; obtain commercial data license or use paid provider |
| Global FX/stocks | Polygon.io / Massive | Plan-dependent REST | Plan-dependent provider WebSockets | Gateway interface planned, no credentials/subscriptions | Account entitlements, latency, exchanges, redisplay/derived data rights and subscription cost |
| Iranian free-market | Navasan | `ohlcSearch` for `usd_sell`, `sekkeh`, `abshodeh`, `18ayar` | JSON REST snapshots (polling, not native WebSocket unless contract provides it) | Existing Navasan adapter; independent license and raw unit audit pending | Commercial rights, instrument-side mapping, calendar, IRR versus IRT discrepancy in untracked migration |
| Iranian free-market | Bonbast | Provider/API contract not independently verified | Provider/API contract not independently verified | No adapter or fetch executed | Published developer API, authorization, license, historical depth, quote-side and units |
| Reference FX | ECB EXR | Daily reference points | Daily fix (not trading ticks) | **762 real observations in Neon, 254/symbol**, existing KV-backed chart | Not a replacement for tradable forex candles, Iranian USD, or continuous market data |

## Technical guardrails

1. CoinGecko `market_chart` gives `[time,price]` and its `total_volumes` is an independent 24-hour series; do not derive OHLC bars from this. Official `/market_chart/range` documentation lists `interval=hourly` up to **100 days per request**; dividing a 365-day range into four requests is an **algorithmic planner only**, not proof the Demo tier grants that lookback or free commercial redistribution.
2. CoinGecko's dedicated OHLC endpoint exists, but granularity and paid options differ from the point endpoint. Only explicitly sourced candle endpoints can feed the candle series.
3. Binance kline timestamp is the source event interval. Normalize market/exchange/timeframe explicitly. Never silently substitute CoinGecko aggregate points as a Binance exchange price.
4. yfinance's code license does not grant redistribution rights to Yahoo market data. Keep research datasets isolated from production persistence and public endpoints.
5. Navasan's provider guide documents `ohlcSearch`. Navasan presents prices in IRR according to its English site; an untracked local SQL migration asserts IRT, contradicting the committed adapter's conversion. Resolve with provider before committing or running that SQL. Distinguish `usd_buy` from `usd_sell`, `abshodeh` (per mesghal) from `18ayar` (per gram).
6. Bonbast is listed as a candidate only. No undocumented JSON shape or URL is assumed.
7. Polygon's provider WS message formats, subscription limits and feed types differ by market. Introduce a provider adapter, not direct unfiltered forwarding.

## Official references for re-verification

- CoinGecko: https://docs.coingecko.com/reference/coins-id-market-chart-range
- CoinGecko OHLC: https://docs.coingecko.com/reference/coins-id-ohlc
- TradingView Lightweight Charts v5: https://tradingview.github.io/lightweight-charts/docs/5.0
- yfinance use warning: https://github.com/ranaroussi/yfinance
- Polygon forex WebSocket: https://polygon.io/docs/websocket/forex/aggregates-per-minute
- Cloudflare Durable Object WS hibernation: https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/
- Navasan archive: https://www.navasan.tech/webserviceguide/

No production data imports, redistributions, or paid subscriptions were triggered by this branch.
