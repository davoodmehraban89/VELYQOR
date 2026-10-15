# سطح خدمت واقع‌بینانه — 2026-10-15

**STATUS: PLANNING ONLY / NO LIVE ALERT SLA.** These are mathematical *free-quota polling budgets*, not measured latency or a contractual vendor delivery guarantee. No new API/provider or alert is activated.

## Official inputs and repository lineage

| Factor | Navasan free | Gheymat Online free |
|---|---|---|
| Documented budget | **120 HTTP requests/month** | **250 HTTP requests/day** |
| Advertised source update | **Every 2 hours** | "لحظه‌ای", but provider explicitly disclaims data timeliness/accuracy guarantees |
| Official source | [Navasan free plan](https://www.navasan.tech/en/api) | [Gheymat Online free plan](https://gheymat.online/price-api) |
| Existing repo evidence | [docs/data/provider-source-matrix.md, main @381ba284](https://github.com/davoodmehraban89/VELYQOR/blob/381ba284d47f284f034afacc7d6cc41fc31af8f9/docs/data/provider-source-matrix.md) | [docs/data/iran-provider-transition-policy.md, PR #22](https://github.com/davoodmehraban89/VELYQOR/blob/phase-1/gold-api-fallback/docs/data/iran-provider-transition-policy.md) |
| Guaranteed upper bound on upstream delay | **تأییدنشده** | **تأییدنشده** |
| End-user alert transport latency | **تأییدنشده** | **تأییدنشده** |

"Every 2 hours" is a claimed provider data update rate; it does **not** override the 120/month API quota.

## Quota math (24/7 periodic polling; no retries/failed calls)

Definitions: B = number of allowed requests per quota window; D = quota window duration in minutes; k = HTTP requests required to get **all watched symbols** in one polling cycle.

Formula: **minimum sustainable evenly distributed polling period P_min = D × k / B** minutes. This is an arithmetic lower bound on the *long-run average spacing of requests*, not the minimum possible delay for an individual notification.

- **Navasan, 30-day accounting month, k=1:** 30×24×60/120 = **360 minutes = 6h**. 31 days: 31×24×60/120 = **372 minutes = 6h12m**. Polling every 2h for 30d consumes 360 calls, **3× above free quota**. If USD and gold require *two* endpoint requests (k=2): **12h** minimum on a 30-day month. Multi-symbol aggregation semantics for this specific account are **تأییدنشده**.
- **Gheymat Online, k=1:** 24×60/250 = **5.76 minutes = 5m45.6s**. If two requests per cycle are required, **11.52 minutes = 11m31.2s**. Whether the desired USD and 18K-gold fields reliably fit one billed API request is **تأییدنشده** until account-level proof.
- Cross-check every Gheymat poll using Navasan is **not sustainable** under Navasan's free 120/month. Additional discovery/history calls also consume quota.

### Suggested operating headroom (planning, not an active Cron config)

| Model | k | Conservative schedule | Calls within stated window | Free budget left | Ideal wait to next poll (not SLA) |
|---|---:|---|---:|---:|---|
| Navasan / 30 days | 1 | **Every 8 hours** | 90/month | 30/month | <8h |
| Navasan / 31 days | 1 | **Every 8 hours** | 93/month | 27/month | <8h |
| Gheymat / 24h | 1 | **Every 10 minutes** | 144/day | 106/day | <10min |
| Gheymat / 24h | 2 | **Every 20 minutes** | 144/day | 106/day | <20min |

At a 7-minute one-call Gheymat interval roughly 206 calls/day are used and only ~44 remain. A scheduled request can fail, be throttled or return unchanged/STALE data; actual observations may be much farther apart.

## Realistic alert timing, and why it is NOT an SLA

Conditional engineering model: **T_user_alert = T_upstream_publication + T_wait_next_poll + T_fetch + T_integrity_gate + T_queue + T_delivery**. Under perfect regular polling, the waiting term may approach P in the worst alignment; it may also be close to zero. Upstream publication delay and delivery time have **no verified upper bound** in either free plan, so a bounded end-to-end maximum cannot be asserted.

| Model | Quota-derived sustainable polling floor | Prototype alert-latency *planning target*, conditional on fresh provider data | Verified end-to-end upper bound |
|---|---|---|---|
| Navasan k=1 | **6h** (30d) | No urgent alert target possible. Even with an 8h safe schedule a threshold can be detected hours late, plus source publication/transport delay. | **تأییدنشده** |
| Gheymat k=1 | **5m45.6s** | Aim to **measure**, not promise, 10–15min from threshold crossing under 10min polling. Unobserved transient crossings may be missed. | **تأییدنشده** |
| Gheymat k=2 | **11m31.2s** | Aim to **measure**, not promise, 20–25min under 20min polling. | **تأییدنشده** |

This table's 10–15min and 20–25min figures are **unvalidated product targets, not observed performance, not guaranteed SLAs, and not universal minimum delivery times**. A crossing may occur immediately before a poll and arrive faster; a source outage may delay it indefinitely.

## Trading-day product decision

**Not acceptable as a time-critical day-trading alert product under free quotas and currently unverified data rights.** These sources cannot promise 1m/5m detection, reliable bid/ask, exact crossing time or execution-grade data.

**Possibly acceptable ONLY as a voluntarily tested, non-urgent and clearly labeled educational/informational price monitor**, after public display and derived-alert rights and quote side are verified. UI must show **«قیمت فروش منبع X»** only when quote-side evidence confirms SELL; otherwise display **«سمت قیمت تأییدنشده — هشدار غیرفعال»**. Show provider timestamp, server receive time, stale state, and notification failure. No buy/sell advice and no money/order operations.

Recommended pilot starting point: one USD_IRT_FREE symbol; one validated source (Gheymat Online only if licensed); one ABOVE/BELOW rule family; one authorized delivery channel. The new [vertical slice roadmap](vertical-slice-roadmap-2026-10-15.md) defines staged tests. All actual notifications are disabled until approved gates pass.

## Incomplete / unverified

No continuous cadence/lag/outage measurement, quota reset timezone, contractual publication bound, authenticated multi-symbol request proof, calendar proof, delivery SLO, channel test, cross-source matching, or public redistribution grant. Documenting suggested cadence does **not** modify production Cron or prices.
