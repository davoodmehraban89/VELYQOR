# VELYQOR / ChartNova

**Iranian market information and *non-advisory* monitoring — development/review project, NOT an execution or brokerage platform.**

Canonical targets: free-market USD/IRT, 18K Iranian gold (IRT/gram), global XAU/USD and explicitly sourced, time-aligned derived values. **No real-money order routing is permitted**; trading automation and guaranteed execution-grade alerts are not in scope.

## Verified source-of-truth hierarchy (as of 2026-10-15)

1. **This GitHub repository** holds reviewed architecture, contracts, tests and historical release evidence; it does **not** automatically reproduce whatever Worker is deployed at Cloudflare.
2. **[Production manifest](docs/operations/production-manifest.json)** records the latest *repository-documented* deployed Worker version, not a live metadata attestation. The last recorded rollback restored **v26** after a user-reported outage on v27. The **technical root cause is تأییدنشده**.
3. **[PROJECT_STATE.md](PROJECT_STATE.md)** is the current review/work checkpoint. Historical paragraphs about v27 being deployed describe a past point in time, not current production status. Full [Stage-1 reconciliation and incident history](docs/operations/chartnova-stage1-production-reconciliation-2026-10-15.md).
4. **Source rights, units, side and cadence:** see the [2026-10-15 official provider evidence matrix](docs/data/provider-source-matrix-2026-10-15.md). A provider being reachable, an API key existing, or a price having a "sellPrice" field does **not** prove redistribution rights or true bid/ask.
5. **Realistic service level:** [free-tier quota calculations and no-guaranteed-latency verdict](docs/product/realistic-service-level-2026-10-15.md). Present free-tier candidates are **not acceptable for time-critical day-trading alerts**.
6. **Next planned scope, not implemented:** [one-source, one-threshold, one-channel vertical slice](docs/product/vertical-slice-roadmap-2026-10-15.md); it remains gated by data rights, quote side, technical/recipient testing and separate merge/deploy approvals.
7. **Complete evidence index:** [Stage-0 evidence register](docs/operations/stage0-evidence-register-2026-10-15.md), with links to immutable main SHA, PR IDs, earlier audits and explicitly unverified claims.

## MVP contract (planned, not all active in production)

- USD_IRT_FREE — free-market USD/IRT (price side/source must be verified before alert activation).
- GOLD18_IRT — Iranian 18K gold/IRT per gram.
- XAU_USD — global spot reference USD/troy ounce.
- GOLD18_THEORETICAL_IRT, GOLD18_PREMIUM_IRT, GOLD18_PREMIUM_PCT — source-timestamp-aligned derived measures; never invented quotes.
- Charts: reference/price-point line data must not be misrepresented as licensed source OHLC.
- Information-only threshold alerts are **proposed**. Live alert/notification delivery and real-money orders are **not verified operational**.

## Engineering principles

- PostgreSQL is the **intended canonical market-data persistence architecture**. Live Cloudflare Worker → Neon direct read was **not established** by the reviewed PRs; current public runtime may rely on KV mirrors. Do not conflate historical database proofs with production wiring.
- Retain canonical instrument mapping, raw/source units (IRR vs IRT), quote side (buy/sell), provider and receive timestamps in UTC; display Iran times in Asia/Tehran.
- Derived values and data-quality checks must retain source provenance and version. STALE/INVALID must suppress downstream price alerts, never silently downgrade.
- Source-specific behavior behind reviewed adapters; non-sponsored no-cost MVP and no paid deployment without separate authorization.
- **No secrets in Git or chat; no order execution; no unapproved migration** of db/migrations/0005_navasan_private_daily_ohlc.sql.
- Preserve uncommitted local files and dirty worktrees. All production changes require separately approved release, valid source artifact, security/CI gates and rollback.
- The React/TypeScript + Vite market terminal is in **Draft PR #24** (stacked on #23); this is **not evidence Next.js or that UI is deployed**. Paper-only manual simulator is Draft PR #27. Lightweight catalog is Draft PR #30.

## Current phase

**Phase 1 — Market Data Integrity & Data Proof; Stage-1 documentation and deployment-manifest reconciliation under review.** The earlier Phase-0 Foundation statement is archived as historical. **This documentation PR has no merge/deploy/runtime effect.**

See [PROJECT_STATE.md](PROJECT_STATE.md), [market contracts](docs/data/market-contracts.md), and [release safety gates](docs/security/P0_RELEASE_GATES.md).
