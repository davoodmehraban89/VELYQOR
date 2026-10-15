# ChartNova — Compact Catalog and Lazy Per-Symbol Series (Stage 1)

Date: 2026-10-15. Review PR: [#30](https://github.com/davoodmehraban89/VELYQOR/pull/30).

**State: implemented in a Draft review branch, automated unit and simulated-live-browser verification successful; NOT DEPLOYED.** Never confuse this with the production Worker.

## Verified baseline

- The public root `https://chartnova.ir/` currently serves the stable Cloudflare Worker **v26** `85177f9d-09c0-4763-b28c-2c6ba5ae5be5`; v27 was emergency-rolled-back in response to the user's blank-screen report.
- The Worker Script download API returns the most recently **uploaded** source (v27), not necessarily the **deployed** v26. Do not upload changes based on the wrong script or overwrite v26 by accident.
- Live read-only requests showed 58 markets at `/api/markets`, approximately **85.2 KB** including up to 168 numeric price points per symbol. A single full-symbol `/api/markets?symbol=USD-IRT` returned approximately 1.5 KB. Source: existing cached `gheymat.online` catalog.
- This provider's historical arrays are **price points**, not validated bid/ask trades, source OHLC candles, execution prices or volume bars. The project must never promote them to executable trading data.

## Implementation and acceptance

1. `packages/market-domain/src/market-catalog-summary.mjs`: standalone projection of existing read-only cached catalog. Validates exact provider identity, timestamps, source/native quote units, positive numeric price data, bounded provider arrays, symbol identity and freshness metadata. Copies current price, change, source timestamp and `historyCount`; intentionally omits bulk `history` arrays and unexpected fields. Fail closed if whole catalog is invalid.
2. `scripts/patch-chartnova-v26-light-catalog.mjs`: source-gated integration into the **original v26** classic Worker. Adds `GET /api/markets/summary` reading the same KV key without writing to it; preserves original `GET /api/markets` contract and scheduler. Rejects multipart download wrappers, previously uploaded v27 code, unknown inline HTML structure, missing expected JS markers and repeated patches.
3. The client first loads the small summary, renders cards/watches without constructing hidden 58-card DOM or technical charts, and retrieves a full verified historical price-point array using the original `/api/markets?symbol=...` **only when a chart is selected**. Client compares source, catalog fetch time, symbol, provider update time, current price, history count, and positive finite values before drawing. It caches at most 12 symbol series and throttles failed retries for 30 seconds.
4. The existing provider, quote side and units remain unchanged; the UI continues to identify visualized series as points/line plots, **not candle OHLC**. No bank/broker APIs, no order flow, no real trading.
5. `packages/market-domain/test/market-catalog-summary.test.mjs`: 10 tests passed. `scripts/patch-chartnova-v26-light-catalog.test.mjs`: 5 integration/negative tests passed. Generic CI and P0 static guard passed for validated commits.
6. `scripts/test-chartnova-live-html-simulator.mjs`: GitHub Actions fetched the **actual public deployed v26 HTML**, patched it **only inside an ephemeral test browser**, and intercepted a new summary endpoint with a projection of the fetched real catalog. It let existing live read-only price and per-symbol historical endpoints respond normally. No production API or HTML was mutated. Successful run on 2026-10-15: original JSON **85,202 bytes**, summary JSON **15,898 bytes** (**81% smaller**); 58/58 market cards displayed; dashboard chart rendered; both USD-IRT and EUR-IRT historical charts fetched on demand; only **one** summary call and **two symbol-scoped** full-series calls were made; zero page JavaScript errors.

## Risk boundaries and next gate

- These tests prove the *prototype and browser behavior*, not a live Cloudflare deployment or an improvement in global request latency. Network RTT, ISP/VPN, browser storage, flaky providers, payload shape drift and eventual consistency can still vary.
- **Do not redeploy v27.** PR #29 was merged for historical traceability but its published hotfix was subsequently rolled back; PR #30 does not inherit its UI patch.
- There is not yet a verified raw **v26 Worker source file** checked into a safe staging process. The Cloudflare source endpoint returns v27 even after rollback. Obtain provenance of v26 before creating any Worker version, then upload **without deploying**, verify KV/secret binding parity and cron handler, perform Chromium + WebKit staged tests and network-throttled client trials. A production rollout is a **separate explicit approval gate**, with instant rollback to v26 documented and rehearsed.
- Do not modify the Windows worktrees with 1,000+ untracked files or the unresolved licensing/Neon migration state. No new credential access, physical trades or money movements.
- More substantial future steps after user approval: per-symbol market-data latency metrics, safe timeout/retry behavior, cache observability, then server-backed and legally entitled read-only price quality, followed by paper-only trading integration from Draft PR #27. Real orders remain out of scope.
