# Stage 2 — observability and read-only health checks (PROPOSAL, NOT IMPLEMENTED)

**2026-10-15; NO new production instrumentation, accounts, payments, Worker changes, service configuration, external telemetry or outgoing notifications.** The incident root cause remains **تأییدنشده**.

## Recommendation: start with native Cloudflare, no third party

- **Workers Logs**: enable only after separate deployment/config approval and verify existing account configuration. Official current Free tier: **200,000 log events/day, 3-day retention, $0**, until Dec 1 2026; upcoming Free Observability quota advertised at **0.5 GB/day, 7 days** from December. Pricing will change; recheck before activation. Source: https://developers.cloudflare.com/workers/observability/logs/workers-logs/ and https://blog.cloudflare.com/one-observability-platform
- **Workers Free**: official **100,000 requests/day**, **10ms CPU/request**, **5 Cron Triggers/account** (limits can change), and Worker KV **100,000 reads/day, 1,000 writes/day**. Verify actual account usage separately; do not write one KV record per request. Sources: https://developers.cloudflare.com/workers/platform/limits/ and https://developers.cloudflare.com/kv/platform/pricing/
- Native logs avoid exposing browser/user telemetry to another vendor; use low-volume structured events + sampling, never a full Request/Response body.
- Suggested structured fields: releaseVersion, deployedWorkerVersion, routeGroup, responseStatus, durationMs, incidentCode, dataProviderAlias, dataAgeSeconds, cacheStatus, serviceWorkerControlled, clientBuild, an **ephemeral** trace/correlation ID. Exclude: cookies, Authorization, API token, complete URL query parameters, chat IDs, personal IP, user financial preferences or precise location.
- **Client exception tracing**: window error and unhandledrejection with sanitized filename/line/column, request failure status and release fingerprint; redaction before any transport. For iOS PWA offline, buffer max 10 minimal items *in ephemeral memory only*, not persistent private storage or unlimited retransmissions. Console from user device is preferable to broad always-on client collection until consent/privacy review.
- **No change during Stage 2**: the current Worker has NO newly activated observability code from this proposal.

## Sentry alternative (not preferred for zero-cost baseline)

- Free **Developer** tier exists at **$0**; current numeric event, session replay, retention and uptime-monitor allowances were **not independently verified on the current official pricing page in this review: تأییدنشده**. Do not quote unofficial "5K/month" as a confirmed current 2026 quota.
- Sentry adds a third-party network dependency, metadata transfer/retention and potential user privacy/jurisdiction problems; a blocked Sentry endpoint cannot be allowed to block site rendering. Use asynchronous, sampled errors only; disable session replay and user PII/headers by default.
- If approved later, bind events to exact release/version ID; filter source maps containing secrets; set consent and data retention controls; avoid automatic billing upgrades.
- Official product explanation: https://sentry.io/for/frontend/ ; official free-plan confirmation: https://www.sentry.help/en/articles/16738709-changes-to-legacy-developer-plans-september-2026 ; official pricing page (numeric quotas unverified here): https://sentry.io/pricing/

## Two minimal health endpoints — design only

1. GET /health/live (no auth/DB/provider): return HTTP 200 with constant service name, **deployed version**, build SHA and current server timestamp; Cache-Control: no-store; no account identifiers. A passing response proves HTTP process availability, **not source/price validity**.
2. GET /health/ready (read-only cache metadata only; do NOT call vendor or write KV): for USD/GOLD18/XAU show availability, provider timestamps, age, quality state and currency/quote-side status *only if contract proven*. For STALE/INVALID return 503 or explicit degraded status, without leaking price payload or API keys. Independently record API response time and SW-controlled vs network response.
3. Monitor both the apex and app subdomain separately; compare from at least two independent networks to detect origin-specific cache/proxy errors. Do not treat smoke from GitHub as an affected user-device proof.
4. When ready check fails: clearly show STALE and suspend future price-alert evaluations (only after alert engine exists), rather than pretending live market data.

**Cost and risk:** Within zero-cost Worker/KV budgets if polled conservatively; each health call counts towards request quotas, each cache read toward KV quota. New health endpoints and logging require explicit later **code review + production approval**. This Stage 2 did not implement them.

## Not complete

No live log collector, Sentry account, health routes, source freshness SLA, mobile consent, provider latency measurements or action on production. All remain **تأییدنشده**.
