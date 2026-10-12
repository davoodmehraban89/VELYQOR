# ChartNova chart presentation package

This is a **client-only React/TypeScript package**, not a deployed ChartNova web application.

## Purpose

- Uses `lightweight-charts` v5 and HTML5 Canvas (`CandlestickSeries` for provider OHLC; `LineSeries` for reference/price points).
- Historical data are loaded from a server-side REST URL (`historyEndpoint`); the component does not contact market vendors or Neon directly.
- Optional `wss://` stream applies `series.update` on sequential messages; on reconnect or sequence gaps, it refetches history.
- No data will render unless a server provides a valid shape with public-use entitlement. No local or synthetic candles are embedded.
- The chart includes a TradingView attribution link. Verify the complete NOTICE requirement before commercial release.

## Install and type-check isolated package

```sh
cd packages/chart-ui
corepack pnpm install
corepack pnpm exec tsc --noEmit
```

For a future Next.js app, import the component from a `"use client"` host, or dynamically with SSR disabled:

```tsx
import {LightweightMarketChart} from "../packages/chart-ui/src/LightweightMarketChart";

export function MarketPanel() {
  return <LightweightMarketChart
    symbol="BTC_USD"
    from="2025-10-12"
    to="2026-10-12"
    timeframe="1d"
    historyEndpoint="/api/v2/history"
    websocketUrl="wss://YOUR-AUTHORIZED-GATEWAY/ws/market"
  />;
}
```

This example is **integration wiring only**: the v2 REST route is still an unmounted repository port, and the WebSocket gateway is not provisioned. No claim is made that the example returns real BTC data today.

## Required server response and separation

`source_ohlc` must be sourced from genuine licensed provider bars with units, timestamp, quality and `approved_public` rights. A `reference_point` has `time/price` only, not artificial OHLC. The currently deployed ECB `/api/history` endpoint has its own legacy response format; bridge it explicitly instead of pretending it supplies source candles.

## Release requirements

A real React app integration, signed market-data contracts, provider entitlements, secure server secret deployment, successful API+WS integration tests, accessible/responsive UI QA and rollback. Never expose database or provider credentials in JavaScript sent to browsers.
