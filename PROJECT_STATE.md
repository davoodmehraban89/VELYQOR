# VELYQOR Project State

Last updated: 2026-10-07

## Current phase
Phase 1 — Market Data Integrity & Data Proof.

## Product scope locked for MVP
- Iran free-market USD/IRT
- Iran 18K gold/IRT market price
- Global XAU/USD
- Theoretical 18K gold/IRT
- Gold market premium/discount absolute and percentage series
- Professional charting, drawing tools, technical indicators, overlays, and persistent user workspaces

## Architecture baseline
- Modular monolith for MVP, with independently schedulable ingestion workers.
- TypeScript/React/Next.js web application.
- PostgreSQL is the canonical database contract; hosting is replaceable through `DATABASE_URL`.
- Neon is the current zero-cost Phase 1 PostgreSQL host; it is infrastructure, not a product dependency.
- Cloudflare is edge/runtime/cache/protection. Hyperdrive is configured only when justified by the deployment path.
- Provider adapters feed immutable raw observations, normalization, quality gates, candle construction, and derived-series calculation.
- UTC canonical storage; Asia/Tehran presentation.
- No UI timeframe may imply precision not supported by observed source cadence.

## Completed
- Phase 0 foundation and provider-neutral PostgreSQL schema merged.
- Canonical instruments, raw observations, ticks, candles, derived values, quality events, workspaces and drawings schema defined.
- Deterministic theoretical 18K gold and premium calculations implemented.
- Timestamp alignment, staleness, provider normalization and provider health implemented.
- Deterministic multi-timeframe candle builder implemented with no synthetic gap filling.
- Numeric quality scoring and propagation into candles/derived data implemented.
- GOOD / DEGRADED / STALE / INVALID quality classification implemented.
- Provider-neutral ingestion and derived-gold pipeline implemented.
- Navasan adapters implemented for USD_IRT_FREE and GOLD18_IRT, including IRR→IRT normalization and historical daily OHLC parsing.
- Alpha Vantage XAU/USD spot adapter implemented.
- Data Proof metrics and aggregate evidence artifact implemented for cadence, freshness, gaps, duplicates and out-of-order observations.
- Market calendar, price-spike detection, provider failure/recovery state machine and persistence hardening implemented.
- Provider source matrix documented, including unresolved domestic redundancy risk.
- PostgreSQL 18 persistence invariants execute successfully in CI.
- Reachable Neon PostgreSQL provisioned for VELYQOR.
- All three database migrations executed successfully against live Neon PostgreSQL.
- Both SQL invariant suites executed successfully against live Neon PostgreSQL.
- Live database proof recorded in `docs/data/phase1-live-postgres-proof.md`.
- Domain regression suite passes: 66/66 tests.

## In progress
- Live Data Proof for USD_IRT_FREE, GOLD18_IRT and XAU_USD.
- Secondary legally usable Iranian source research for cross-check/failover.

## External blockers
1. `NAVASAN_API_KEY` is not connected to the runtime, so live USD_IRT_FREE and GOLD18_IRT cadence/quota/freshness proof cannot yet execute.
2. `ALPHAVANTAGE_API_KEY` is not connected to the runtime, so live XAU_USD proof cannot yet execute.
3. Cloudflare Hyperdrive is not configured yet. The Cloudflare account currently has zero Hyperdrive configs, and creating one requires the live database credential to be entered through a secure channel without exposing it in repository history or chat.

## Phase 1 exit gates
1. PostgreSQL migrations and invariants execute successfully against a live reachable PostgreSQL instance. **PASS**
2. USD_IRT_FREE, GOLD18_IRT and XAU_USD each have a live tested ingestion path. **BLOCKED — provider credentials**
3. Observed cadence, latency, gaps, duplicates, out-of-order behavior and failure/recovery are recorded for each source. **BLOCKED — provider credentials**
4. Candle construction is deterministic and never invents missing observations. **PASS**
5. Quality state/score propagates into candles and derived values. **PASS**
6. At least one secondary legally usable reference is identified for Iranian market cross-check, or the lack of one is explicitly accepted as a launch risk. **PASS as documented unresolved launch risk**
7. Secrets are runtime-only and absent from the repository. **PASS**
8. CI is green for all Phase 1 domain behavior. **PASS**
9. Cloudflare Hyperdrive is configured against the reachable PostgreSQL endpoint. **BLOCKED — secure database credential handoff**

## Risks
- Iranian market-data licensing, timestamp quality, anti-bot restrictions, history and reliability.
- Free source cadence may be insufficient for intraday timeframes; unsupported timeframes must stay disabled.
- The current domestic-source stack does not yet have a second zero-cost legally usable failover source.
- Free database hosting is temporary infrastructure and must not become a product dependency.

## Next checkpoint
Securely connect the Navasan and Alpha Vantage runtime credentials and the Neon database credential to Cloudflare Hyperdrive without committing or exposing secrets; execute continuous live Data Proof for all three required instruments; record provider and Hyperdrive evidence; then close Phase 1 only if all external gates pass.

## Handoff update — 2026-10-11: ECB history and direct-Neon work
- **Verified in production Neon:** 762 licensed ECB EXR daily reference observations in `market_ticks`, 254 per EUR_USD_ECB/EUR_GBP_ECB/EUR_CHF_ECB, 2025-10-13 to 2026-10-09; 0 invalid/duplicate checks. The `candles` table remains empty. The 2026-10-11 importer `--commit` reported 0 *new* rows; do not attribute prior inserts to this run.
- **Verified deployed:** existing `/api/history` retrieves 254-row annual observations through Cloudflare KV and line-chart UI; live smoke also passed domestic, widget, and Scriptable routes. This is not yet a live PostgreSQL read.
- **Implemented in isolated GitHub branch, not deployed:** bounded/parameterized Neon-first API with KV fallback, 9 passing Worker history unit tests and syntax check.
- **Security blocker:** SQL-created `chartnova_history_ro` has read access exclusively to the ECB history view but is NOLOGIN awaiting secure credential activation. An API-created `chartnova_history_reader` unexpectedly inherited privileged `neon_superuser` membership and **must not be used**; deletion was completed and confirmed absent in pg_roles after user approval. Safe Cloudflare secret handoff was blocked, and `CHARTNOVA_HISTORY_DATABASE_URL` is absent.
- **Next checkpoint:** secure least-privilege role credential through approved dashboard, complete API+UI integration and live test on a reviewed Worker deployment, then continue seeking explicitly licensed OHLC sources. Details and rollback are in `docs/data/neon-history-direct-handoff-2026-10-11.md`.

## 2026-10-11 — Security cleanup verified
With explicit user approval, the unused overprivileged Neon role `chartnova_history_reader` was deleted. Independent queries confirm 0 remaining matches, `chartnova_history_ro` still present with read access only to the ECB view and `NOLOGIN`, and ECB history remains **762 observations (254 per symbol)**. No deployed Worker secret or application code was changed. Pre-delete role configuration and post-delete evidence: `docs/security/neon-history-reader-predelete-2026-10-11.md`.

## 2026-10-11 — OHLC license gate, secure historical API and chart provenance (isolated branch)
- Added `packages/market-domain/src/licensed-ohlc-history.mjs`: strict source-OHLC-only staging validation; explicit human-reviewed licensing metadata, commercial-storage/public-redistribution rights, exact base-ten IRR→IRT normalization for declared pairs, UTC offsets + IANA session zone, no invented volume/candles, duplicate and missing-session diagnostics, and strict annual-publication readiness gate. The gate verifies *claims* in a license manifest, not the authenticity of any signed agreement.
- Added regression tests `licensed-ohlc-history.test.mjs` and `licensed-ohlc-release.test.mjs`. Domain suite **85/85 PASS**.
- Tightened `GET /api/history` input (duplicates/empty dates), cached public-response allowlist, non-empty series gate. Added `deploy/chartnova/history-security.test.mjs`.
- Synced `deploy/chartnova/history-ui.js` into embedded Worker UI, removed hard-coded KV provenance, and added `history-ui-sync.test.mjs`. Worker/history **14/14 PASS**, Worker syntax PASS. None of these changes are deployed to Production.
- Independent read-only audit of user's uncommitted `db/migrations/0005_navasan_private_daily_ohlc.sql` found a **raw currency unit discrepancy**: the proposed SQL claims IRT, whereas committed Navasan adapter interprets IRR and divides by ten. Migration remains unexecuted and user's uncommitted files untouched. Must verify provider units and licensing before any import.
- Source guide from Navasan documents `ohlcSearch` but not definitive commercial redistribution terms. No Navasan/TGJU/OHLC records were written to Neon. `candles` remains 0 and licensed ECB remains 762 reference points.
- `chartnova_history_ro` remains a database NOLOGIN role; Worker has no direct Neon secret binding. Manual secure activation and live integration tests are required; only the existing KV-based reference chart is live.
- Evidence and remaining gates: `docs/data/ohlc-licensing-and-ingestion-gate.md`, `docs/data/neon-history-direct-handoff-2026-10-11.md`.

## 2026-10-11 — CI gate remains RED (independent verification)
- GitHub Actions run `38172295674` on PR #23 / head `7d0912e1e7777cea882ddc70e49d2f6d3932dc9f` was reported **completed / failure** in both jobs: `verify` and `postgres-invariants`. The workflow-job log downloads returned GitHub 404 `BlobNotFound` and step summaries were empty; the precise failure cause could not be verified.
- Local isolated-worktree results remain **85/85 domain** and **14/14 Worker/history** PASS, with Worker syntax PASS. These results **do not replace a green remote CI**.
- The connected Windows device has Corepack-managed `pnpm 10.17.1` but no standalone `pnpm` on PATH, so `corepack pnpm verify` stopped when its nested `pnpm` command was unavailable. The device has no available `psql` or `docker` CLI for locally reproducing the PostgreSQL CI job. Do not treat this as a proven application defect or green full verify.
- **Release gate:** keep PR #23 draft and do not merge/deploy on the strength of local tests; recover CI logs or reproducible runner diagnostics and resolve both jobs first. GitHub run: https://github.com/davoodmehraban89/VELYQOR/actions/runs/38172295674

## 2026-10-12 — requested multi-market REST/WS/Canvas foundation (isolated branch)

- User requested React + TradingView Lightweight Charts v5 (Canvas), bounded REST historical APIs, WebSocket live architecture, and candidates CoinGecko, Binance, yfinance, Polygon, Navasan and Bonbast. Original local Git worktree, ECB history and deployed Market/Widget APIs left unchanged.
- Branch `feature/chartnova-multimarket-chart-ws-foundation` is based on `feature/chartnova-neon-direct-history`, separate from `main` and **not deployed**.
- Added `packages/market-feed` canonical reference-point vs source-OHLC contracts; CoinGecko point adapter + bounded hourly query-window planner; Binance spot-kline adapter; yfinance research-only adapter; provider registry; versioned WS subscription/sequence guard; and `/api/v2/history` bounded/paginated REST repository-port handler (unmounted; fails closed if no licensed repository).
- Added standalone `packages/chart-ui` React/TypeScript Lightweight Charts v5 component. Candles render only for `source_ohlc`; ECB and CoinGecko price points use a line. The component expects a future React/Next.js host and already links TradingView. Installed its isolated package's dependencies only in an isolated test worktree; did not change the existing user's app.
- Added `deploy/chartnova/realtime-gateway.mjs` Cloudflare Durable Object WebSocket gateway scaffold with subscription allowlist/limits and authenticated private publisher, plus a non-deployed Wrangler example. **No live feed publishers, durable object instance, Cloudflare secret or public WebSocket deployment exist.**
- Reference documentation: `docs/architecture/ADR-0004-multimarket-rest-ws-charts.md`; `docs/data/multimarket-provider-matrix.md`.
- Local verification on an isolated worktree: **30/30 market-feed tests PASS**, **115/115 total domain+market-feed tests PASS**, new WebSocket gateway `node --check` PASS and client chart `tsc --noEmit` PASS. These are pure behavior tests / type validation; provider availability, live WebSocket latency, DB I/O and license entitlement have NOT been proved.
- Important guardrails: CoinGecko `market_chart` only produces price points, not OHLC; annual hourly planning ≠ Demo-tier entitlement. Binance API previously geoblocked (451). yfinance is research/personal-data-use only absent licensing. Navasan OHLC requires commercial rights and independent IRR/IRT/quote-side verification; Bonbast developer contract/API schema unavailable; Polygon WS plan not provisioned.
- Neon production remained 762 ECB reference observations and zero OHLC candles at the last direct verification; no imports were triggered by this work. Existing `chartnova_history_ro` is still NOLOGIN, so direct read-only Neon Worker history is not activated.
- Next checkpoint: written redistribution rights + provider keys via secure server-side secret manager; select initial requested instruments and quote-side/currency conventions; integrate a real React host and licensed read-only Neon repository; deploy a staging WS gateway under explicit authorization; run integration/latency/quota/staleness/reconnection/rollback tests and obtain green CI before public release.

## 2026-10-12 — Remote CI release gate (latest run)
- Draft PR #24: https://github.com/davoodmehraban89/VELYQOR/pull/24
- GitHub Actions run **38174358477** (CI #76) reported **failure** in BOTH `postgres-invariants` and `verify` jobs. Download of either job log via GitHub API returned `404 BlobNotFound`; no reliable error stack/root cause could be established. This is an unresolved release blocker.
- Despite standalone **115/115 local tests**, gateway syntax and chart TypeScript checks passing, remote CI is NOT green. Do not deploy or merge as production-ready until remote CI is diagnosable/green and actual licensed sources are connected.
- Production database check: `chartnova_history_public` **762** reference observations; `candles` **0** OHLC; restricted role exists and removed overprivileged role remains absent.

## 2026-10-12 — Standalone ChartNova terminal and REST/WS compatibility verified locally
- Added runnable `apps/market-terminal` React + Lightweight Charts v5 app, pinned npm lockfile, Vite development proxy to existing ECB REST, and visible TradingView attribution. Built twice with a clean `npm ci` from isolated Git worktree; final `npm run build` PASS.
- Selected `deploy/chartnova/market-stream-worker.mjs` and its matching per-symbol DO binding template as the single **future** WebSocket deployment candidate. `realtime-gateway.mjs` remains a non-deployed alternative with a different protocol and must not be pointed at the React client without a deliberate conversion.
- REST→chart integration tests now cover `serveHistoryV2` consuming genuine `time/price` points and source OHLC into Lightweight Charts without accidental format mismatches; provider-neutral REST returns public `rights` attestation only after server license checks. WebSocket UI refetches history on sequence gaps/reconnect. Updated versioned data source adapter accordingly.
- Selected gateway hardened with origin allowlist, bounded streamed request payload and per-symbol connection limits; still requires Cloudflare Access/WAF/rate limits and real E2E before any publication.
- Final local `npm test`: **117/117 PASS**; gateway syntax PASS; `npm ci && npm run build` PASS. `scripts/research-yfinance.py` not runtime-tested because no Windows Python installation.
- **Release remains blocked**: GitHub CI remote still RED, no privileged DB credentials used, no DO deployed, no paid plan authorized, no licensed OHLC backfilled, no live WSS source established. Neon 762 ECB points and zero candles preserved. Full handoff: `docs/operations/chartnova-multimarket-checkpoint-2026-10-12.md`.

## 2026-10-12 — Restricted Neon v2 query + WS room load-shedding (review branch)
- Added `packages/market-feed/src/neon-ecb-history.mjs` with a parameterized ECB-only read adapter using the existing `public.chartnova_history_public` view and accepting only `chartnova_history_ro` credentials server-side. A new `GET /api/v2/history` route is mounted **in the feature branch's Worker source only**; without the optional Cloudflare secret it fails closed with 503. Live Worker remains unchanged and retains its verified KV-backed `/api/history`.
- New server/adapter tests verify cursor and limit, exact ECB provenance, no secret leaks, zero OHLC misclassification; no live direct Neon connection yet. New WebSocket Durable Object tests verify monotonic sequence, room authorization and slow-client disconnect after >1 MiB outgoing buffer; no deployed DO yet.
- Latest isolated local checks: **126/126** domain+feed tests, **18/18** Worker/history tests, both Worker syntax checks and standalone React production build **PASS**.
- Real Neon still has **762** ECB reference points, **0** OHLC candles; `chartnova_history_ro` remains NOLOGIN, former privileged reader absent. Cloudflare bindings still only MARKET_CACHE, NAVASAN_API_KEY, OANOR_API_KEY.
- PR #24 remains draft and GitHub CI **RED**: run **38197941929** (#93) reported both `verify` and `postgres-invariants` failing. The job logs return 404 BlobNotFound, so no root cause is verified. No provider permissions, staging deployment, paid Cloudflare Durable Objects, or production publication approved or attempted.
- Full handoff: `docs/operations/chartnova-neon-v2-ws-quality-2026-10-12.md`.

## 2026-10-12 — CI pre-run diagnosis and real local WebSocket smoke
- GitHub Actions run 38198123692 (#95) was inspected via **raw GitHub REST jobs endpoint**, not merely summarized status: both `verify` and `postgres-invariants` had `runner_name=""`, `steps=[]`, and completed in about 3 seconds. Therefore **the tests never started**; do not claim application/SQL failure or CI success. The reason for runner non-allocation remains unknown. See `docs/operations/github-actions-pre-run-failure-2026-10-12.md`.
- Wrangler 4.149.0 successfully **compiled** the selected DO Worker through `deploy --dry-run`, showing expected DO and environment bindings; no deploy happened.
- Real **localhost-only** WSS smoke passed: HTTP 101 WebSocket handshake, `stream.subscribe` → `session.ready`, test-only private publisher HTTP 200, `market.update` delivered to 1 client with monotonic `sequence=1`. The event contained fictional TEST-ONLY values, never persisted to Neon or production systems. Local Worker and child `workerd` process were stopped.
- Repeatable smoke script: `scripts/smoke-local-stream.mjs`. Evidence: `docs/operations/chartnova-ci-local-ws-smoke-2026-10-12.md`.
- No live provider entitlement, operational secret, production DO, public market data, or code deployment has been enabled. Existing dirty Windows worktree stays untouched. PR #24 remains Draft, blocked on runner allocation, security and data licenses.


## 2026-10-14 — Paper-only position risk manager (PR #27; isolated feature)

- **User intent:** build professional stop-loss, take-profit, trailing stop, hypothetical P&L and position event tracking in VELYQOR/ChartNova. Explicit user instruction: **no real buying/selling or order submission**.
- **Source added:** `packages/market-domain/src/paper-position.mjs` — pure deterministic memory-only, manual scenario LONG/SHORT position creation, SL/TP, trailing, net P&L with hypothetical commission/slippage and once-only bracket-style exit; no network, broker, DB or API side effects.
- **UI added:** `apps/market-terminal/src/PaperTradingPanel.jsx` with form, hypothetical event timeline, manual scenario updates, close/restart and explicit **PAPER ONLY** status. `main.jsx` integrates on the right side; price-line overlays show entry, stop and take-profit on the existing chart. Responsive CSS added.
- **Independent CI:** `.github/workflows/paper-trading-ci.yml` tests 14 engine scenarios, performs broker/network import check, `npm ci` and builds actual terminal with Vite.
- **Verified GitHub Actions for commit `9bfe8891ecf204b5e19c5a6aea61affdec21d77c`:** simulation job **SUCCESS** (all four steps), main `verify` **SUCCESS**, `postgres-invariants` **SUCCESS** on 2026-10-14. First run failed due JavaScript negative-zero P&L; logic normalized -0 and rerun passed.
- **Docs:** `docs/trading/paper-trading-stage1.md`. PR: https://github.com/davoodmehraban89/VELYQOR/pull/27 (Draft). Based on #24, which is based on #23; no merge into main or deployment.
- **Real trading status: PROHIBITED.** No exchange/broker API, no capital movement, no scheduled execution. ECB history points are not executable quotes and cannot trigger simulated fills. User must manually enter a fictional market price per scenario step.
- **Remaining:** actual licensed, tradable bid/ask with trusted live quote contract and staleness/sequence filters; server-owned paper portfolio persistence and concurrency-safe audit; reconciliation/reconnection; backtest, risk limits, graph trading UX tests; staged deployment only after explicit approval and stacked PR acceptance.
- **Separate repository main:** PR #25 (P0 safety) and PR #26 (live-proof test portability) were explicitly authorized and merged 2026-10-14, reaching `main` SHA `0fadaf7dc7df96dbd7aadf0bf9eaf7bbc83ce257` at verification. This stacked PR branch has not been rebased onto that main and must be reconciled before merge.
- **Local PC:** Desktop Commander was offline at the latest October 14 check. Existing modified and untracked user worktrees untouched.
