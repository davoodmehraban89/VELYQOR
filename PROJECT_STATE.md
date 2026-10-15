# VELYQOR Project State

## Latest Stage-1 checkpoint — 2026-10-15 (DOC-ONLY / not yet merged)

**Review base:** [main 381ba284d47f284f034afacc7d6cc41fc31af8f9](https://github.com/davoodmehraban89/VELYQOR/commit/381ba284d47f284f034afacc7d6cc41fc31af8f9). This heading **supersedes all time-specific "current production" claims below** without falsifying the historical events.

- **Production runtime last RECORDED, not live-rechecked in this documentation stage:** Cloudflare Worker v26 version ID **85177f9d-09c0-4763-b28c-2c6ba5ae5be5**, 100%; rollback deployment ID **78155d6f-11fc-4d1b-ab4f-7c0a97474406** (2026-10-15 05:59 UTC). The prior v27 release **2cbeb4e2-4a3e-414f-b3ad-035e2378650b** had been activated, then **rolled back after the user reported the site would not open**. The technical root cause is **تأییدنشده**. See [exact evidence and incident timeline](docs/operations/chartnova-stage1-production-reconciliation-2026-10-15.md), [versioned manifest](docs/operations/production-manifest.json), [rollback-branch record](https://github.com/davoodmehraban89/VELYQOR/blob/ops/chartnova-emergency-rollback-2026-10-15/PROJECT_STATE.md). **Current live version at this exact moment: تأییدنشده**, because Stage 1 made no Cloudflare inspection.
- **Repository:** PR [#29](https://github.com/davoodmehraban89/VELYQOR/pull/29) was merged previously; its reviewed scripts/tests/docs do **not** provide an exact verified complete deployed Worker source for v26. **PR #29 cannot be "merged again".** The stale v27 heading below is retained solely as an archival account.
- **PR inventory checked via GitHub (before creating Stage-1 documentation PR):** 7 OPEN: [#21](https://github.com/davoodmehraban89/VELYQOR/pull/21), [#22](https://github.com/davoodmehraban89/VELYQOR/pull/22), Draft [#23](https://github.com/davoodmehraban89/VELYQOR/pull/23) → Draft [#24](https://github.com/davoodmehraban89/VELYQOR/pull/24) → Draft [#27](https://github.com/davoodmehraban89/VELYQOR/pull/27), Draft [#28](https://github.com/davoodmehraban89/VELYQOR/pull/28), Draft [#30](https://github.com/davoodmehraban89/VELYQOR/pull/30). PR [#25](https://github.com/davoodmehraban89/VELYQOR/pull/25) and [#26](https://github.com/davoodmehraban89/VELYQOR/pull/26) had already merged. Old PR inventory and old source-secret blocker paragraphs below are **historical**, not current authorization. **Draft [PR #31](https://github.com/davoodmehraban89/VELYQOR/pull/31) is the new documentation-only review, so the open PR count became 8 at its creation; no merge or deploy was performed.**
- **Provider/quote integrity:** Old development plans Navasan and Alpha Vantage, while later PR/deployment records mention Gheymat Online, Oanor/TGJU UI label and Gold API. **Exact production mapping, quote side, commercial redistribution/storage rights and time-bounded latency are تأییدنشده.** No OHLC source is promoted to production by this docs PR. [Official provider matrix](docs/data/provider-source-matrix-2026-10-15.md).
- **Free service level:** Official Navasan 120/month, 2h vendor updates → sustainable 30-day one-call interval **6 hours minimum**; Gheymat Online 250/day → **5m45.6s minimum** for one request per snapshot. Neither can guarantee threshold-alert delivery latency. **Not acceptable as a time-critical day-trader alert SLA**; only optional non-urgent informational pilot after license/semantics verification. [Full assumptions and alternate k=2 model](docs/product/realistic-service-level-2026-10-15.md).
- **Next implementation proposal (NOT authorized here):** one USD_IRT_FREE source, one ABOVE/BELOW informational alert, one opted-in **Bale Bot** notification channel, quote labeled **«قیمت فروش منبع X»** *only after provider-side SELL verification*, otherwise alerts disabled. [Gated minimal vertical slice](docs/product/vertical-slice-roadmap-2026-10-15.md). Additional ATR/OCO/Trailing, failover and Paper Trading explicitly follow actual pilot evidence.
- **Security/no-change guarantees:** No merge, production Worker deploy, DNS/Cloudflare config, Neon/KV mutation, paid resource, API-key access, real trade or local Worktree action in Stage 1. Untracked **db/migrations/0005_navasan_private_daily_ohlc.sql** stays blocked; most recent local worktree audit (2026-10-12) remains **historical; present state تأییدنشده**. [Evidence index A–H](docs/operations/stage0-evidence-register-2026-10-15.md).
- **Open acceptance gates:** current deployed-v26 versioned code source/hash, affected-device outage reproduction, written provider rights, exact quote side/unit, real-source cadence, actual quota consumption, and delivery-channel proof. Not complete.

---



## Historical 2026-10-15 — ChartNova v27 performance hotfix (deployed then ROLLED BACK)

- **User request:** fix delayed/blank-to-loaded ChartNova initial data, prioritizing visible quote cards and avoiding unnecessary waiting.
- **Actual live Worker fixed:** `velyqor-preview` Cloudflare **v27** `2cbeb4e2-4a3e-414f-b3ad-035e2378650b`, deployment `c68b8340-398a-462b-9fe0-c635aba405fe`, rolled out at 100% on `2026-10-15T05:22:32Z`. Original v26 `85177f9d-09c0-4763-b28c-2c6ba5ae5be5` is retained for immediate rollback.
- **Change scope:** only production homepage inline JavaScript; progressive main-card render; explicit partial loading; lazy hidden market/technical rendering and de-duplicated refresh. **No change to API response contracts, data prices/units, provider licensing, KV namespace, secrets, cron, DNS, database, trades or Worktrees.**
- **Verification:** 4/4 isolated JS patch tests passed. Staged mobile browser found 58/58 cards and working technical chart; quotes exactly matched previous production and no JS/network failures. Under intentionally delayed 10-second `/api/markets`, main USD/Gold cards and partial status appeared before the slow feed finished. Following deployment, public `/`, `/api/domestic`, `/api/markets` (58), `/api/xau`, `/api/widget` all responded successfully.
- **Risk controls:** Cloudflare API verified full binding/handler parity between versions. No secret values were read. Keep old version for one-step rollback if post-deploy errors appear. User's actual device experience still requires confirmation.
- **Traceability:** [PR #29](https://github.com/davoodmehraban89/VELYQOR/pull/29) and [operations/rollback guide](docs/operations/chartnova-production-progressive-loading-2026-10-15.md). GitHub `main` was not changed during the direct Cloudflare rollout; PR #29 is reviewed independently.
- **Not completed:** universal network speed guarantee; shrink of 85KB full market-history payload; new Paper Trading live deployment; Neon/WS real trading/feeds. These are separate staged milestones.

---


Last updated: 2026-10-07

Last checked (GitHub-only): 2026-10-14

> **IMPORTANT — review-branch status overlay (not yet merged into main).** The detailed sections below preserve the 2026-10-07 Phase-1 baseline. Its claims about disconnected provider keys and CI do **not** reflect a 2026-10-14 live runtime revalidation. Cloudflare previously exposed a `NAVASAN_API_KEY` secret name (not a verified end-to-end data proof); the current connected secret values were not read.

## Current safety checkpoint — 2026-10-14

- Working source of truth remains `main` at `29a45cff094658c7a2722fa6fa712bef061abb8c` until explicitly merged; review branch: `safety/p0-triage-2026-10-13`.
- Open PRs [#21](https://github.com/davoodmehraban89/VELYQOR/pull/21), [#22](https://github.com/davoodmehraban89/VELYQOR/pull/22), [#23](https://github.com/davoodmehraban89/VELYQOR/pull/23), [#24](https://github.com/davoodmehraban89/VELYQOR/pull/24), [#25](https://github.com/davoodmehraban89/VELYQOR/pull/25), and [#26](https://github.com/davoodmehraban89/VELYQOR/pull/26). PR #23 is based on the history feature branch; PR #24 is based on #23. PR #25 and #26 are isolated reviews from `main`.
- GitHub CI: #21, #22, #23 succeeded on second attempts 2026-10-14; #24 succeeded on its latest verified attempt 2026-10-12; #25 and #26 succeeded on 2026-10-14. A green CI does **not** establish data licensing, provider uptime, a real production Neon→Worker connection, or deployed streaming.
- **P0 PROTECT:** last verified Windows evidence included 9 tracked modifications, 1085 untracked paths and 5 worktrees. Desktop Commander was offline on 2026-10-14. No cleaning, overwriting or migration applied.
- **P0 BLOCK_IMPORT:** untracked `db/migrations/0005_navasan_private_daily_ohlc.sql` conflicts with existing adapter IRR→IRT assumptions. No import or migration before source-confirmed units/quote side, rights and reviewed dry-run.
- **P0 BLOCK_REDISTRIBUTION:** commercial source-OHLC storage and public redistribution rights remain unverified. ECB observations are reference points, not OHLC candles.
- **P0 NO_LIVE_ORDERS:** AI/signals cannot place live orders; independent order/risk controls and separate approval are required before any trading layer.
- Next actions: review independent #21/#22/#25/#26 for prospective merges; preserve #23/#24 as Draft until dependency, license, Neon reader, staging and end-to-end gates pass; verify Windows and provider documentation when available.
- Auditable details and ownership: [P0 triage](docs/security/P0_TRIAGE_2026-10-12_FA.md), [release safety gates](docs/security/P0_RELEASE_GATES.md), [PR readiness](docs/security/PR_READINESS_2026-10-14_FA.md).
- **Status of this checkpoint:** documentation and CI pass on review branches; **no merge to `main`, no operational deployment, no credential changes, no trade**.

---

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
