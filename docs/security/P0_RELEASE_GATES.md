# VELYQOR — P0 Safety and Release Gates

**Recorded:** 2026-10-13  
**Status:** HOLD for production changes; review-branch guard only.  
**Parent:** \`main\` at \`29a45cff094658c7a2722fa6fa712bef061abb8c\`.  
**Evidence:** [P0 execution and decision record](./P0_TRIAGE_2026-10-12_FA.md).

## Scope and ownership

This branch is a non-production review checkpoint. It MUST NOT be considered approval to merge another branch, run \`db/migrations/0005_navasan_private_daily_ohlc.sql\`, activate a provider, deploy a Worker or place a trade. Do not rewrite a dirty local worktree. Only the project owner can approve a scope-expanding action, and financial/credential/billable actions need separate explicit authorization.

| Gate | Default | Owner | Evidence needed before release |
|---|---|---|---|
| Local dirty worktrees | PROTECT | Project coordinator | Owner inventory; verified backup/snapshot procedure, no reset/clean/stash/overwrite without consent |
| Navasan \`ohlcSearch\` units/quote side | BLOCK IMPORT | Market Data & Quant + DB | Vendor-confirmed per-symbol IRR/IRT, bid/ask and time contract; actual sanitized payload; unit-factor tests; reviewed transactional dry run and rollback |
| Commercial OHLC storage/public redisplay | BLOCK | Product/Legal + Data | Verified contract rights by provider, market, use case, attribution, retention and redistribution; private contract stored outside public GitHub |
| AI/signals to real orders | PROHIBITED | Security + Trading | Separate approved order/risk architecture, permissions, idempotency, limits, kill switch, negative integration tests and explicit launch approval |
| Phase 1 live-data proof | OPEN | QA + Market Data | Continuous measured cadence/freshness/gaps/duplicates/outage recovery and realistic alerting |
| Branch acceptance/deployment | HOLD | QA/Release | Relevant green CI, unit/integration/E2E security tests, live authorization, rollback evidence and owner's separate release approval |

## Automated check included on this branch

- \`node --test scripts/check-p0-safety.test.mjs\`
- \`node scripts/check-p0-safety.mjs\`
- \`.github/workflows/p0-safety.yml\` runs the checks on a pull request or when manually dispatched on an eligible ref. It does **not** deploy, access live databases, read credentials or submit orders.
- The guard rejects a proposed \`0005\` migration or migrations containing the current Navasan OHLC source markers. It also detects drift of the current unit assumptions and the explicit no-AI-order rule.
- A green guard is only a **static repository-level check**: it is NOT proof of provider licensing, correctness of external prices, complete absence of order-execution code, runtime permission hardening or production readiness.
- After genuine evidence and owner review, modify the static guard **in the same reviewed change** as the approved migration; do not disable it silently.
- This workflow exists only on this isolated branch at present and **is not an enforced required check for \`main\`**. Branch protection and merging are separate owner-approved tasks.

## Immediate follow-up

1. Preserve all 5 Windows worktrees and the known untracked \`0005\` migration. Do not automatically sync this branch into that device.
2. Obtain direct Navasan commercial/OHLC unit and redistribution evidence outside public GitHub.
3. Once remote device access returns, rerun the full domain test suite from the repository root and compare tracked/untracked status before/after.
4. Review PR #21–#24 with their actual base dependencies, keeping PR #23 and #24 draft until runtime, licensing and security gates clear.
5. Do not perform migrations, Cloudflare deployment, credential/role updates or real trading as part of this branch.
