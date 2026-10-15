# Minimum vertical slice: one source × one rule family × one delivery channel

Status: DESIGN ONLY — **no code, webhook, cron change, real message, trade, payment, merge or deployment** as part of Stage 1. Subsequent implementation requires separate owner approval.

## Pilot purpose and unambiguous scope

Validate with **2–5 consenting real users** whether deliberately *non-urgent informational* Iranian-market threshold alerts have any value, before implementing ATR, OCO, multiple providers or Paper Trading.

| Axis | ONE choice for initial vertical slice | Gated evidence |
|---|---|---|
| Instrument | **USD_IRT_FREE** only (one source-defined domestic USD quotation) | Repository canonical unit IRT_PER_USD: [market-contracts](../data/market-contracts.md) @ main 381ba284 |
| Market-data provider | **Gheymat Online only**, *conditional* on explicit rights and verified exact market/side/units. Do not treat its reported sellPrice key as conclusive SELL proof. | [Official API/free plan](https://gheymat.online/price-api), [official-doc gap matrix](../data/provider-source-matrix-2026-10-15.md), [PR #30 data shape](https://github.com/davoodmehraban89/VELYQOR/pull/30) |
| Alert family | **ABOVE** or **BELOW** a user-entered numeric threshold on one explicitly defined, verified quote side; no trailing/ATR/prediction, no AI strategy | Existing quality primitives [data-quality.mjs](../../packages/market-domain/src/data-quality.mjs), no production alert engine currently established in main |
| Price side displayed | **«قیمت فروش منبع Gheymat Online»** ONLY IF provider contract identifies the observed field as selling quote for this exact instrument. Otherwise show **«سمت قیمت تأییدنشده — هشدار غیرفعال»** and do not send. | Bid/ask semantics and execution availability: **تأییدنشده** |
| Delivery | **One Bale Bot message channel** to opted-in recipients, not Eita, Telegram or Web Push in the first cut | Official Bale Bot API response/send constraints, rate caps and availability: **تأییدنشده**. Must validate official documentation, sender identity, per-user opt-in and safe secret injection before activation. No tokens in GitHub or chat. |
| Polling | **10min planned**, assuming ONE billed Gheymat API call per full snapshot; *if not*, recalculate and change contract prior to implementation | [Arithmetic and lack of SLA](realistic-service-level-2026-10-15.md): 144 calls/day, leaving 106/day headroom at k=1 |
| UI wording | **«هشدار اطلاع‌رسانی غیرتوصیه‌ای»**; show provider name/quote side/timestamp and condition state. No "بخر" or "بفروش" instructions | Existing product rule [main README](../../README.md); this doc's acceptance |
| Real-money orders | **None, prohibited** | [P0 release gates](../security/P0_RELEASE_GATES.md) |

### User flow (one complete user journey)

1. User sees one licensed, timestamped SELL quote; if unit, side, rights, timestamp or quality cannot be verified, UI says **«تأییدنشده — هشدار غیرفعال»**.
2. User creates a single ABOVE/BELOW watch rule with amount and optional name, explicitly opts in to a Bale bot; server stores channel routing metadata with minimum access.
3. A scheduled acquisition event validates symbol, **IRT vs IRR conversion**, provider quote side, monotonic source timestamp, max age, market session and sensible spike bounds. For stale, quality failure or invalid quote, **suspend** all dependent threshold evaluations and show reason; never generate a price alert from bad data.
4. One source-valid crossing moves the event into durable triggered state. Minimal dedupe identifier: (user_id, rule_id, source_event_timestamp, transition) plus a semantic rule epoch/version. Prevent repeated processing, retry storms and duplicate notifications. Confirm triggering policy (e.g., two consecutive *valid* samples) before coding.
5. Outbox records **PENDING → SENT / FAILED**, bounded retries and error identifiers; mark NOTIFIED only upon verified successful provider send response, not just attempted HTTP call. Receiver read/ack is **UNVERIFIED** unless Bale bot API provides a confirmed read receipt.
6. UI shows the latest event and delivery outcome; no pseudo-live trading indicators or order execution.

### Definition of Done for this SINGLE vertical-slice PR (after separate approval)

- [ ] Written vendor rights for storing and displaying USD SELL quote and generating derived alerts; exact raw/canonical units, source timestamp and quote side reviewed and linked to a non-secret license record.
- [ ] Source API quota authenticated and evaluated with a **sanitized single-response sample**, one-snapshot request count verified, no secret published.
- [ ] Exact one-symbol, one-price-side contract; UI shows the provider and source timestamp; UI never shows financial advice.
- [ ] No real-order code paths, network requests to brokers or AI-to-trade permissions.
- [ ] Pure unit tests for ABOVE/BELOW boundaries, STALE, out-of-order, duplicate, source outage, spike quarantine, pause/recovery, and idempotency.
- [ ] Integration tests for one Bale send adapter (mock), 429/500/timeouts, bounded retry, dedupe and persisted failure status; official API docs and non-sensitive callback proof.
- [ ] Simulated lost connectivity and browser reload; UI clearly communicates stale/failed states.
- [ ] GitHub CI green **on exact head SHA** plus full browser E2E with synthetic data; no newly invented quotes.
- [ ] Real opted-in user delivery only after explicit, separate operational activation permission; any real send is an external action and requires the user's authorization.
- [ ] Quota instrumentation, no secret values in logs; clear kill switch to disable all outgoing notifications and restore previous Worker without dropping rules.
- [ ] Pilot measures provider refresh age, sample gaps, alert detection lag, transport delay, false positives and failures. **Do not promise a bounded SLA** without measurements.

### Rollback and safety

Feature flag **disabled by default**; deployment (if later approved) does not enable alerts automatically. Revert flag to disabled and cease outgoing delivery without deleting user preferences; leave events auditable. If old Worker contract regressions occur, restore the previous manifest-pinned version only after confirming actual active version, bindings and user approval. Never execute unreviewed migration 0005 or overwrite local worktrees.

## Following work — ordered ONLY after pilot evidence

| Next increment | Requires demonstrated need |
|---|---|
| (1) **Trailing Stop / ATR, take-profit, OCO** | License-valid source OHLC and source-high/low timestamps, stable delivered simple threshold alerts. No guessed ATR from 168 price points. |
| (2) **Secondary provider + failover/cross-check** | Source-side verified symmetric quote units/sides and written rights, observed gap/outage incidents, cross-provider divergence bounds. |
| (3) **Backtest + Paper Trading** | Verified historical OHLC and calendar; keep [PR #27](https://github.com/davoodmehraban89/VELYQOR/pull/27) draft in the stacked [#23→#24→#27] chain until independently reviewed; never connect any broker or order execution. |

## Decision gate

If no free provider grants documented rights for the exact pilot quotation/derived alerts, **the pilot stays data-disabled**; show only simulated fixtures in local/staging, clearly tagged SIMULATION. This is a genuine legal/product blocker, not something to bypass by scraping.

**Not complete:** vendor license, final source-side sample, Bale official bot API capability, quota test, persistent engine, UI, sender, recipient opt-in, real delivery, measured usability. This document is a proposed vertical slice and no user-facing feature has been released.
