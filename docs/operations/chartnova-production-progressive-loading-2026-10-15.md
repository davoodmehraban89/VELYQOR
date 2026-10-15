# ChartNova — Production Initial-Load Performance Fix (2026-10-15)

## Verified incident and cause

User reported that `https://app.chartnova.ir/` eventually opened but initial prices loaded late. Direct external API checks confirmed successful market data with 58 symbols, but `/api/markets` returned approximately 85 KB and response durations fluctuated.

Read-only inspection of the **actual Cloudflare-deployed** `velyqor-preview` Worker version 26 found that the browser:
- initiated independent `/api/domestic`, `/api/xau` and `/api/markets` requests;
- waited for `Promise.allSettled` on **all three** before replacing the loading status;
- rendered the 58-card market grid and technical chart even when their tabs were hidden, and rendered them again after the batch finished.

This is a client rendering bottleneck on slow networks. It is not evidence of provider-data corruption or a DNS outage.

## Production change (performed)

- PR: [#29](https://github.com/davoodmehraban89/VELYQOR/pull/29)
- Cloudflare zone: `chartnova.ir`; existing app/root Worker routing preserved
- Worker: `velyqor-preview`
- **Previous deployed Worker version:** `85177f9d-09c0-4763-b28c-2c6ba5ae5be5` (v26, 100%).
- **New deployed Worker version:** `2cbeb4e2-4a3e-414f-b3ad-035e2378650b` (v27, 100%).
- **Deployment ID:** `c68b8340-398a-462b-9fe0-c635aba405fe`
- Deploy date/time (UTC): `2026-10-15T05:22:32.348955Z`.
- This was a *direct Cloudflare version upload/deployment* using exact fetched production code as baseline; the GitHub patcher and tests are the reviewable source of the change.

The scoped change **only** modifies the HTML page's inline JavaScript. The page now displays the main price-card values as soon as their separate requests finish, shows an explicit partial-load status, does not repeatedly render market grids/technical charts while their tabs are hidden, and prevents overlapping refresh cycles. All original Worker API route logic, KV reads/writes, scheduler, quote units/source/rights handling, P0 trading prohibition, DNS, hosting, and cron behavior are unchanged.

## Independent verification

**Before production release**:
- GitHub Actions: 4/4 patcher tests passed.
- Actual Chromium mobile browser opened both Worker Version URL and production, verified identical real quote values, all 58 market cards, technical view, zero JS exceptions, zero failed requests.
- The controlled *10-second intentionally delayed market-feed* test demonstrated the behavior improvement:
  - **Old production:** USD and gold had populated, but status stayed `در حال دریافت داده‌های ذخیره‌شده...`.
  - **New staged version:** USD and gold were populated and status advanced to `قیمت‌های اصلی بررسی شدند · در حال دریافت نمادها...`; it did not build hidden market cards.
  - Both eventually rendered all 58 cards when the market tab was visited.
- Worker v27 binding parity confirmed via Cloudflare API: `MARKET_CACHE` (identical KV namespace), `NAVASAN_API_KEY` and `OANOR_API_KEY` (names/types only; **secret values were not accessed**); `fetch` and `scheduled` handlers preserved.

**Immediately after production release:** Cloudflare deployment API confirmed v27 at 100%; external GET requests succeeded for `/`, `/api/domestic`, `/api/markets` (58 symbols), `/api/xau` and `/api/widget`. Data quality flags were `ok:true` and non-stale where applicable.

CI browser revalidation following this documentation update must be checked separately; no user-device check can be inferred from cloud-side tests.

## Rollback

If the public site starts showing missing quotes, syntax errors, or fails to render, revert deployment to **existing v26** (no need to delete/alter KV or DNS):

`POST /accounts/{account_id}/workers/scripts/velyqor-preview/deployments`

Body:
```json
{"strategy":"percentage","versions":[{"version_id":"85177f9d-09c0-4763-b28c-2c6ba5ae5be5","percentage":100}],"annotations":{"workers/message":"Rollback ChartNova progressive loading hotfix"}}
```

Only the Worker deployment percentage should change; KV, secrets and DNS remain untouched. Verify `GET /deployments` and real HTTP/browser tests afterward.

## Limits / following improvements

- This fix improves *perceived* load and avoids unnecessary rendering. It does **not** make ISP/VPN/Cloudflare network transport uniformly faster or shrink the existing 85KB all-symbol history payload.
- Next optimization should introduce a small, licensed and unit-consistent summary endpoint with on-demand historic series for the selected chart, but must be staged and tested without confusing reference points with executable OHLC or weakening price integrity checks.
- The Windows Desktop Commander still requires reconnection for local validation; do not reset dirty worktrees.
- ChartNova live site runs an earlier preview UI; Paper Trading PR #27 remains separate and **is not deployed**.
