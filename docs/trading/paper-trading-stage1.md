# VELYQOR — Paper Trading & Position Risk Controls (Stage 1)

**Status: SOURCE IMPLEMENTED ON A DRAFT FEATURE BRANCH; NOT DEPLOYED; NOT REAL MARKET EXECUTION.**

## Purpose

Offer an educational, deterministic *paper-only* position-risk manager modeled on common trading-platform controls: stop-loss (SL), take-profit (TP), fixed bracket exits, trailing stop, live-style unrealized/net P&L, event audit, and visual horizontal levels.

The first stage is **manual-scenario input only**. The user supplies an entry price, capital, optional estimated execution fees/slippage, and each scenario price. No automated market feed can trigger a paper exit in this stage. Existing ECB daily reference observations are not executable quotes; they are never represented as trade fills.

## How to access locally after review

The React/Vite frontend is currently in the stacked Market Terminal feature (not in `main`, nor deployed on `app.chartnova.ir`). On a safe isolated checkout of this branch:

```sh
cd apps/market-terminal
npm ci
npm run dev
# production artifact smoke: npm run build
```

The `PaperTradingPanel` is inside the standalone terminal's right column. It accepts canonical symbol/side, fictional capital, fictional entry price, % SL/TP, optional trailing stop, commission/slippage basis points; displays current stop and TP as chart price-lines when history is loaded; outputs a per-step event timeline.

## Safety contract

- No exchange keys or endpoints, no broker SDK, no money movement, no wallet, no order placement calls.
- The pure deterministic module `packages/market-domain/src/paper-position.mjs` is in-memory; UI scenario disappears upon refresh, not persisted. No claim of durable account history.
- Use only explicitly typed manual scenario observations; never claim a manual price is a live executable bid/ask.
- For the hypothetical LONG position, stop trigger is when scenario price <= effective stop; profit trigger is >= TP. For SHORT the comparisons reverse. The stop follows the highest/lowest favorable observed scenario price if trailing is enabled.
- OCO semantics **inside the simulator**: a position exits at most once. At a trigger, the alternate bound becomes irrelevant because the position is CLOSED; this is not a real broker OCO order.
- The exit price is the **observed scenario price adjusted by adverse configured slippage**, not the threshold. A stop cannot guarantee execution at the stop level; exchange outages, jumps, spreads and liquidity are not reproduced faithfully.
- A fictional fee is applied at entry and exit. Percent net return uses initial quote-unit capital. There is no leverage, margin borrowing, overnight swap, financing, tax, FX conversion, or real exchange order book.
- No guarantee of detecting a market peak, profitable exit or future direction; mathematical trailing threshold is not predictive analysis.
- User-visible status MUST say “PAPER ONLY” and “manual scenario” prominently.
- Core AGENTS rule `AI/signals may never directly execute an order.` remains effective.

## Acceptance and limitations

**Tests:** market-domain paper-position tests cover Long/Short, SL/TP, trailing, gap-like jumps, slip/fees, monotonic timestamps, invalid entries, and no duplicate exit. CI also must build the actual Vite frontend and keep the pure module free from network/broker imports.

**Not complete:** actual live feed entitlement, quote-side bid/ask and tradeability, latency/staleness protections, verified real-time tracking, persistence in Postgres, portfolio management, backtesting, multiple paper positions, provider costs, advanced indicators, and real-money execution. Those require a future reviewed contract and staged integration.

## Future verified-feed integration gate (not wired)

A future **quote-only** adapter must supply canonical symbol, source identifier, licensed tradable-bid/ask, timezone-qualified UTC source timestamp, received timestamp, declared currency/unit, data-quality score/status, sequence number, verified source rights and freshness. Reject stale/invalid/replayed/out-of-order/gap events; require reconnection reconciliation, concurrency-safe idempotent paper fill audit and explicitly configured paper portfolio ownership. Historical ECB observations and source OHLC must not be silently substituted for an executable quote.

**Production and broker trading remain blocked.** The feature branch is stacked onto `feature/chartnova-multimarket-chart-ws-foundation` (PR #24), itself stacked on PR #23. No PR #24 deployment or merge is authorized by this work.
