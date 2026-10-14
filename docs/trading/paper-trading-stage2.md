# VELYQOR Paper Trading — Stage 2: Multi-position workspace and quote preflight

**Date:** 2026-10-14. **Review branch:** `feature/paper-trading-risk-controls-2026-10-14` / [PR #27](https://github.com/davoodmehraban89/VELYQOR/pull/27). **NOT deployed; NO live orders.**

## Product acceptance

A user can create up to **10 concurrent paper positions** (maximum **50 stored positions**, including closed ones), switch between positions on the selected market symbol, manually enter successive hypothetical prices, view the current fixed/trailing stop and take-profit levels, close a hypothetical position once, and export a CSV of all events. Positions are restored from local browser storage after refresh. The initial MVP risk panel is also documented in [stage 1](./paper-trading-stage1.md).

- `packages/market-domain/src/paper-position.mjs`: deterministic Long/Short simulation, percent SL/TP and trailing-stop; fees, adverse hypothetical exit slippage and event timeline.
- `packages/market-domain/src/paper-workspace.mjs`: immutable multi-position workspace, maximum active count, replay-checked restore, per-position summaries and CSV export.
- `apps/market-terminal/src/PaperTradingPanel.jsx`: React panel; uses browser `localStorage` key `velyqor.paper-workspace.v1`; no network calls to write money or trades.
- `packages/market-domain/src/paper-quote-guard.mjs`: separately testable **future integration boundary only**, for authenticated/backend-verified bid/ask snapshots. Checks exact source allowlist, explicitly reviewed simulation-display entitlement metadata, GOOD quality, open-market flag, strict order sequences, source and receive UTC times, configurable age, unit, bid/ask spread and correct adverse exit side. There is **no importer, publisher, brokerage connector or live-feed auto-trigger connected**.

## Security and accuracy constraints

1. **NO LIVE ORDERS:** no broker key, exchange order API, wallet or settlement. No AI command can cause real trade execution.
2. **MANUAL SCENARIOS:** each paper mark is a user-entered hypothetical price, not a verified executable quote or current market price. A simulated trigger only closes a local paper position.
3. **LOCAL ONLY:** browser storage is not encrypted, tamper-proof, server-side, cross-device, backed up or attached to an authenticated account. Do not store real assets, personal financial account details or API secrets here. If restore validation fails, automatic overwriting is blocked; user explicitly decides whether to reset.
4. **NO MIXED-CURRENCY SUM:** `EUR_USD_ECB` paper quote-unit results are not summed with `GOLD18_IRT` or `XAU_USD` results. Each row reports its own quote-unit P&L, and currency conversion is not inferred.
5. **MARKET DATA INTEGRITY:** ECB daily reference observations are not tradable bid/ask. Gold spot reference point, CoinGecko price points, or source OHLC bars cannot be silently promoted to live executable bid/ask. No quote is connected until source rights, bid/ask meaning, freshness, market/session status, latency, quote unit and real-world licensing are established.
6. **QUOTE-GUARD IS NOT AN ENTITLEMENT AUTHORITY:** supplied strings like `reviewed_simulation_display` cannot prove legal permission or authenticity. A future secure server gateway must authenticate the provider, verify signed policy/permission and ensure clients cannot forge price source or turn simulated orders into real ones.
7. **NO PROMISE OF SL FILL:** SL/TP and trailing stops are based on observed hypothetical prices; a gap can close below/above the threshold. This simulator does not model full limit-order book depth, spread evolution, liquidity, market impact, financing, taxes, leverage, liquidations, partial fills or brokerage execution.
8. **TRANSPARENCY:** show `PAPER ONLY`, `MANUAL SCENARIO`, separate real-data chart source badges and quote quality. The API itself MUST NOT claim the user has real trading capital, actual positions or realized financial returns.

## Quality gates

- `node --test packages/market-domain/test/paper-*.test.mjs`
- `node --test packages/market-domain/test/*.test.mjs packages/market-feed/test/*.test.mjs` (full domain/feed suite where available)
- `cd apps/market-terminal && npm ci && npm run build`
- `./.github/workflows/paper-trading-ci.yml` runs simulation tests, network/broker import checks and Vite build; main CI validates generic domain + PostgreSQL invariants.
- Client-local restore tests rebuild all financial fields from manual events; this detects inconsistent data and accidental corruption, **not sophisticated attacker-forged coherent local events**.
- Stage 2 code is stacked onto PR #24. Do not merge or publicly deploy until its underlying PR #23/#24 acceptance and licensing/Neon/WS tests are satisfied; the GitHub `main` stream already contains independent PR #25/#26 safety changes, and must be reconciled in a reviewed integration.

## Next gate: genuinely updating paper prices

A future **server-owned simulation worker** can accept only authenticated, explicitly entitled, fresh, sequenced real bid/ask from a vetted provider; validate via the quote guard; maintain durable server-side paper positions with a tamper-resistant event log, idempotent state transitions, gap/outage reconciliation, clock/skew handling, open-market sessions and role-based access. Client controls remain **paper only**. Instrument-specific spread, price precision, stop behavior and session rules must be configured. Actual buying/selling requires a **separate explicit product and security authorization** and is out of scope.


## Scenario-only trend and risk/reward

The React panel also displays a compact **manual-scenario sparkline** from entered OPEN/MARK prices and a descriptive trend classification computed by `packages/market-domain/src/paper-trend.mjs`. At least five prices are required; otherwise it returns `INSUFFICIENT_SCENARIO_DATA`. It compares 3- and 5-observation simple moving averages and five-point momentum, with a narrow neutral range. Initial gross `take_profit_distance / stop_loss_distance` is displayed as an educational risk/reward ratio; it excludes costs and does not claim expected realized profit.

This is **NOT technical analysis of a live market**: it is analysis of user-entered fictional scenarios. It is **not a forecast**, signal, financial advice, tradeable price discovery or automatic trigger for any real order. The calculated direction must never replace the market quality, legal entitlement and executable bid/ask checks.

The six paper-trend unit tests cover insufficient data, rising, falling and sideways manual sequences, initial risk/reward and invalid state. `node --test packages/market-domain/test/paper-*.test.mjs` covers all paper suites.
