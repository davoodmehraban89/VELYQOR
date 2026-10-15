# ChartNova Stage 1 — reconciliation of Git history and production records

**Date:** 2026-10-15. **Type:** docs/manifest ONLY. **Base:** main at [381ba284d47f284f034afacc7d6cc41fc31af8f9](https://github.com/davoodmehraban89/VELYQOR/commit/381ba284d47f284f034afacc7d6cc41fc31af8f9). Not an operational change or real-time Cloudflare audit.

**First-party repository evidence:** [Stage-0 indexed register](stage0-evidence-register-2026-10-15.md). **Machine-readable historical record:** [production-manifest.json](production-manifest.json). **Separate updated vendor evidence:** [official-source matrix](../data/provider-source-matrix-2026-10-15.md).

## Version facts and incident timeline, not guessed root causes

| Event | UTC time | version/deployment | Source of record | Verification scope |
|---|---|---|---|---|
| Before hotfix | Historical | v26, Worker version 85177f9d-09c0-4763-b28c-2c6ba5ae5be5 | [PR #29 production operations record](chartnova-production-progressive-loading-2026-10-15.md) | Snapshot of earlier production; raw source hash **تأییدنشده** |
| Direct Cloudflare hotfix | **2026-10-15 05:22:32** | v27 / deployment c68b8340-398a-462b-9fe0-c635aba405fe | [PR #29 operations doc](chartnova-production-progressive-loading-2026-10-15.md) | Deployed then; not proof it remains live |
| User report after hotfix | After v27 publication, before rollback | Site not opening on user device | [Rollback branch incident evidence](https://github.com/davoodmehraban89/VELYQOR/blob/ops/chartnova-emergency-rollback-2026-10-15/PROJECT_STATE.md) | **Reported incident**. No client JS trace, browser logs or network waterfall in the repo |
| Emergency rollback | **2026-10-15 05:59:12** | Restored v26 / deployment 78155d6f-11fc-4d1b-ab4f-7c0a97474406, documented 100% | [Rollback branch state](https://github.com/davoodmehraban89/VELYQOR/blob/ops/chartnova-emergency-rollback-2026-10-15/PROJECT_STATE.md); [PR #30 state](https://github.com/davoodmehraban89/VELYQOR/blob/95e1389ba313c14652cf380182e5ea4b34007b3e/PROJECT_STATE.md) | **Last repository-recorded production state**; not rechecked live in Stage 1 |
| Later user report | After rollback | Root URL chartnova.ir opens and speed improved | [PR #30 state](https://github.com/davoodmehraban89/VELYQOR/blob/95e1389ba313c14652cf380182e5ea4b34007b3e/PROJECT_STATE.md) | Reported by user; app subdomain resolution and device logs **تأییدنشده** |

**WHY v26 was restored:** after the v27 frontend-loading hotfix was released, the user explicitly reported the site would **not open on their device**. The rollback was a **risk-containment response**, not a demonstrated causal attribution. The historical snapshot notes independent HTTP and API checks succeeded after rollback, but this is NOT proof that v27 JavaScript caused the outage.

**What is missing to establish root cause:** browser console stack trace/line, affected device/browser/OS/version, capture of HTTP waterfall including Service Worker/cache, failing resource and status, actual bad HTML/bundle hash served to the affected browser, VPN/ISP routing, controlled A/B reproduction and timestamp correlation. **ROOT CAUSE = تأییدنشده.** Do not label the incident "fixed by progressive loader", and do not automatically redeploy v27.

## GitHub synchronization — precise meaning

- [PR #29](https://github.com/davoodmehraban89/VELYQOR/pull/29) was already **MERGED** into main; **never merge it again**. It committed a patcher/test/workflow/documentation, not the exact historical complete Worker source.
- The main HEAD [381ba284](https://github.com/davoodmehraban89/VELYQOR/commit/381ba284d47f284f034afacc7d6cc41fc31af8f9) preserves stale descriptions: [README.md](../../README.md) describes "Phase 0", [PROJECT_STATE.md](../../PROJECT_STATE.md) still puts v27 in the leading hotfix section, and [provider-source-matrix.md](../data/provider-source-matrix.md) is an archived Oct-05 development-candidate plan.
- PR [#30](https://github.com/davoodmehraban89/VELYQOR/pull/30) adds compact 58-symbol summaries and on-demand historic price points, is **DRAFT, UNMERGED, NOT DEPLOYED** and its v26 patcher explicitly warns that the Cloudflare Worker source-download endpoint was serving last-uploaded v27 even after rollback. There is no independently version-matched raw v26 Worker source manifest on main.
- Proposed fix in this **docs-only PR**: top-level README and PROJECT_STATE use one authoritative [production-manifest.json](production-manifest.json), preserve historical v27 incident paragraphs as archived not current status, correct PR counts/bases, and link official provider rights/latency matrix. It does not move UI or API code, rerun PR #29, activate PR #30, write KV or migrate Neon.
- Before **any future** Worker update: obtain the exact v26 source artifact and its cryptographic hash associated with Cloudflare's deployed version ID (not just "latest uploaded"), deterministic build recipe, current non-secret binding/cron metadata and a safe staging environment. Then unit + Chromium + WebKit + actual affected-device tests, independent signed-off rollback, owner approval for merge and a distinct approval for production deployment.

## Explicit source-provider boundary

- [README.md at main @381ba284](https://github.com/davoodmehraban89/VELYQOR/blob/381ba284d47f284f034afacc7d6cc41fc31af8f9/README.md) and [main provider matrix](https://github.com/davoodmehraban89/VELYQOR/blob/381ba284d47f284f034afacc7d6cc41fc31af8f9/docs/data/provider-source-matrix.md) describe **architecture/development candidates**; they do not attest that Navasan/Alpha Vantage supply every displayed production quote.
- [PR #29 operational record](chartnova-production-progressive-loading-2026-10-15.md) names secret/binding metadata and Gold API; [PR #30 catalog proof](https://github.com/davoodmehraban89/VELYQOR/blob/95e1389ba313c14652cf380182e5ea4b34007b3e/docs/operations/chartnova-compact-catalog-stage1-2026-10-15.md) describes data fetched with attribution Gheymat Online. The exact path linking every UI label ("Oanor/TGJU", "Gold API") to upstream acquisition, quote side, rights and source timestamps is **تأییدنشده**.
- Do not display a price with the label **«قیمت فروش منبع X»** until the exact source-field/symbol/side is authenticated. Do not infer USD_IRT_FREE or GOLD18_IRT units from magnitude or the presence of a "sellPrice" JSON key.

## What still is NOT completed

No exact raw-v26 source or SHA256, no current Cloudflare metadata comparison, no full client-side outage reproduction, no licensed public-data right, no server-side order-proof for any price quote, no historical OHLC for intraday ATR, no outgoing alert engine, and no real-user pilot. Source-rights, free-tier SLA and the planned [one-source, one-rule, one-channel vertical slice](../product/vertical-slice-roadmap-2026-10-15.md) are documented, not implemented.

## Proposed evidence acceptance for the NEXT approved change

1. Obtain and review metadata/source provenance without reading or logging any secret **values**.
2. Document exact small pilot contract and receive provider permission; only then code one complete vertical slice.
3. Do not mutate untracked db/migrations/0005_navasan_private_daily_ohlc.sql or the dirty Windows worktrees. 
4. Every future PR must report actual test job URLs/head SHA, roll-forward/back plan, unresolved risk and explicitly separate **review PR approval**, **merge approval** and **production deploy approval**.
