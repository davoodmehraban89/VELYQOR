# ChartNova staging checkpoint — CI and local WebSocket evidence (2026-10-12)

## CI diagnosis (verified)

The GitHub Actions run at https://github.com/davoodmehraban89/VELYQOR/actions/runs/38198123692 failed **before runner allocation**, not in a test step. Direct GitHub jobs API returned **no runner names and empty steps arrays** for both verify and postgres-invariants, both completed in about 3 seconds. No code or migration test executed in this CI run. Root cause of runner non-allocation is unconfirmed; check the repository's Actions General policy and account Actions billing/quota/budgets before trying to fix source code. See `docs/operations/github-actions-pre-run-failure-2026-10-12.md`.

## Cloudflare Worker compilation

Ran from isolated development worktree on authorized Windows host:

`npx --yes wrangler@4 deploy --dry-run --config deploy/chartnova/wrangler.realtime.example.toml`

Result: **PASS** with Wrangler 4.149.0, local script bundle 15.88 KiB, and expected bindings `STREAM_ROOMS` Durable Object, `STREAM_SYMBOL_ALLOWLIST`, and `STREAM_ALLOWED_ORIGINS`. The command exited on dry-run and did NOT deploy or create billed resources.

## Actual local WebSocket publish/receive

Ran a local Worker and Durable Object instance using Wrangler and a **fictional localhost-only test token**. Then executed `node scripts/smoke-local-stream.mjs` (the script explicitly rejects non-localhost origins).

Observed:
- `GET /stream?symbol=EUR_USD_ECB` returned **101 Switching Protocols**.
- A version-1 `stream.subscribe` received `session.ready`.
- An authenticated **fictional test-only reference-price event** posted to `/internal/market-update` returned **HTTP 200**.
- A connected WebSocket received `market.update` with `sequence=1` and `delivered=1`, without revealing the test publisher token or license evidence.
- The local Worker and child workerd process were stopped after the test. No real vendor market price, live public WebSocket, Neon insert, paid Cloudflare deployment, or public website change occurred.

## Prior local checks

- **126/126** domain / feed tests passed; **18/18** Worker / history tests passed.
- Existing standalone React + Vite + Lightweight Charts build passed.
- Production Neon still recorded 762 ECB reference observations, zero OHLC candles, and an unactivated `chartnova_history_ro` database role at the start of this checkpoint.

## Remaining production gates

1. Obtain precise GitHub pre-run failure annotation from administrator; fix account/Actions policy or runner provisioning; require green CI after jobs actually run.
2. Acquire documented licensed source for commercial redistribution of each intended market; validate quote units/timezones. Neither research-only Yahoo/yfinance data nor point observations may be converted into fake OHLC.
3. Securely activate least-privileged Neon reader via approved secret flow, and prove live read-only Worker→Neon connectivity on staging.
4. Approve any billable Durable Object / production deployment; configure true publisher credentials and edge rate limits.
5. Perform sustained staging real-time load/latency/sequence-gap, browser rendering, and failure/recovery tests before public launch.

The original Windows Git working tree was preserved, including its uncommitted Navasan migration.
