# ChartNova — seven-track risk work, review record (2026-10-21)

**Status: Draft implementation, NOT deployed, NOT integrated into user-facing product, NOT merged.**
Branch: \`risk/chartnova-seven-track-safety-2026-10-21\`, PR [#33](https://github.com/davoodmehraban89/VELYQOR/pull/33). Main base SHA \`4649149b1f920aecbe4c26597983d9bb35d90427\`.

This iteration treats **A–G from the user-supplied Stage-0 scope** as the seven workstreams because no separate literal seven-item checklist was identified. This interpretation MUST NOT be confused with approval to merge already-open PRs #21/#22/#23/#24/#27/#28/#30. No production API, published Worker, database, cron, PWA or real alert was changed.

## Traceability by workstream

| Track | Implemented, testable in this PR | NOT YET COMPLETE / production acceptance gate |
|---|---|---|
| **A — repository ↔ Worker provenance** | [Stage-1 manifest](production-manifest.json) and [exact rollback evidence](chartnova-stage1-production-reconciliation-2026-10-15.md) already on main through merged PR #31; this PR does not mutate it. | Exact last-deployed v26 Worker raw source hash and historical affected-device failure remains **تأییدنشده**; no direct source equality reconciliation possible. |
| **B — provider / failover** | \`packages/market-domain/src/licensed-provider-selector.mjs\` verifies matching unit, side, instrument, timestamps, distinct providers, and explicit independent resale/alert rights. Explicit single-source fallback without fake dual-source verification. | No documented actual domestic second-source licensing or production adapter calls. Provider entitlement and actual response shape remain **تأییدنشده**. |
| **C — data integrity** | \`alert-data-gate.mjs\`: stale/cut-off, future-date guard, duplicate/out-of-order suppression, spike quarantine with second observation or legitimately entitled secondary, source divergence, market closed, auto-suspension, recovery N samples. | Not wired into live API or Cron; no empirical provider timestamp SLA. |
| **D — alert engine** | \`informational-alert-engine.mjs\`: pure ABOVE/BELOW, entry %, stop-loss, take-profit, LONG/SHORT ATR or optional percentage trailing, OCO protection priority, confirmation N/time, wrong quote-side block, one-shot state ARMED/TRIGGERED/NOTIFIED/CLOSED and cooldown field. | Durable multi-worker event journal, server authentication/authorization, atomic reset/cooldown policy, real ATR source OHLC and UI language review NOT implemented. None of this issues an order. |
| **E — notification** | \`notification-outbox.mjs\`: read-only pure bounded retry/lease/ack/failure state; \`bale-once-adapter.mjs\`: injected transport, private-chat \`getChat\` preflight, at-most-one sendMessage POST, redacted errors and unknown-outcome handling. | Not connected to atomic database outbox nor PWA/Eita; actual consenting account ID/token unavailable; no real message sent or end-user delivery proof. *Exactly-once across concurrency not guaranteed without transactional persistence.* |
| **F — free-tier limits** | \`free-quota-budget.mjs\`: dated Navasan 120/month, Gheymat Online 250/day, 28–31 day budget calculator, conservative reserve, no fabricated latency guarantee. | Current vendor entitlements/account usage and live Cron schedule **تأییدنشده**; planning only. |
| **G — backtest/paper** | \`educational-atr-backtest.mjs\`: licensed, chronological provider OHLC input required; Wilder ATR; compare conservative fixed-percent vs ATR trailing; explicit simulated/no executable-price guarantee and non-advisory labels. | No licensed actual OHLC, no end-user simulator session UI, market fees/slippage path, no live tests; cannot claim validated historical performance. |

## Tests and review approaches

- CI \`pnpm test\` / \`node --test packages/market-domain/test/*.test.mjs\` includes all new normal/negative/boundary tests alongside the existing domain suite.
- \`scripts/review-chartnova-risk-lenses.test.mjs\` is separately run on two *independent GitHub runners* for static security properties and 1,000-case seeded adversarial invariants. \`functional-qa\` is a third isolated CI runner. **These are three independent automated CI jobs, NOT three independent AI/human review agents.**
- The connected Notion Custom Agent service returned \`entitlement_required\` (Business plan) when searching for three independent agents. Do not upgrade/pay or claim agents approved. This external review requirement is **UNFULFILLED**.
- No secret read or committed; no new real-money orders or broker network clients; no user-facing claim of real-time or assured alerts. Scope deliberately keeps real production data, untracked migrations and worktrees untouched.
- The draft PR and its test code can be abandoned/closed without touching production. There is **no runtime rollback**, because no production changes were made.

## 2026-10-21 second-pass risk-hardening audit (same unmerged PR)

Reviewed the actual domain implementation and expanded failure/edge coverage. All changes are isolated to PR #33; do not mistake green CI for a licensed production integration.

| Concrete review finding | Reproduction condition | Fix in PR #33 | Evidence |
|---|---|---|---|
| **HIGH: primary quote could pass quality gate without explicit data rights** | Source object lacked `permission.publicDisplay` or `permission.derivedAlerts` | Gate now returns `RIGHTS_UNVERIFIED` and suspends all price alerts | `packages/market-domain/test/alert-data-gate.test.mjs` |
| **HIGH: misaligned/unlicensed secondary could confirm a price spike** | Second quote was older than first or had no licensed public usage/alert rights | Require independent entitlements, matched symbol/side/unit and configurable provider timestamp skew (default 60s); fail closed without publishing a price alert | Same gate tests |
| **HIGH: duplicate or out-of-order observation did not persist suspension/recovery reset** | Fresh duplicate arrived after `GOOD`; returned state retained old `suspended:false` | Suspend until configurable number of distinct valid samples have re-established quality | Same gate tests |
| **HIGH: an ambiguous Bale send error could be reported as safely failed** | POST timed out, HTTP 500, malformed JSON or wrong chat in provider's response after attempting send | Return `UNKNOWN` without automated retry; no successful-delivery claim | `packages/market-domain/test/bale-once-adapter.test.mjs` |
| **HIGH: expired outbox lease could produce duplicate notifications** | Worker crashed after sending but before saving provider receipt; a later Worker claimed expired lease | Expired LEASED state now becomes `UNKNOWN` and is not automatically retried | `packages/market-domain/test/notification-outbox.test.mjs` |
| **MEDIUM: historical study could silently splice unrelated provider OHLC** | Same price side/unit but changed provider or symbol partway through a series | Reject any mixing of provider, symbol, side or unit; require explicitly licensed OHLC and non-advisory reference results | `packages/market-domain/test/educational-atr-backtest.test.mjs` |
| **MEDIUM: individual module tests did not prove cross-component source-gate-to-send safety** | Valid source, spike, threshold rule, mocked Bale acceptance or uncertain send in one flow | Added full pure-domain integration tests with no live calls | `packages/market-domain/test/integrated-alert-safety.test.mjs` |

**QA status:** Before the final rerun, one negative test failed because its shared observation fixture accidentally **inherited licensed permission** from the default test quote, while the test intended an unlicensed secondary. The fixture was corrected to set `permission:null`, then re-run; do not attribute that test error to runtime behavior. This is part of the verifiable test history, not hidden.

**Remaining release blocker, by design:** a pure in-memory state machine does not provide a transactional durable outbox, a verified rights registry, user authentication or exactly-once message delivery. The safest response to an unknown provider result is to **halt automatic retries and require human reconciliation**, not to promise exactly-once delivery. No real user notification or API secret was used. All modules are **experimental and unmerged**.

**Review independence:** GitHub Actions runs functional, static/security and seeded-adversarial jobs independently on isolated runners; these are **NOT independent human or AI code-review agents**. The three-agent approval requirement has not been met because the available Notion agent interface requires a Business plan. No cost was incurred to bypass it. Do not call PR #33 production-ready.


## Specific adversarial/control risks left open

1. Injecting arbitrarily large jump from a source lacking explicit quote-side/license evidence must not cross the quality gate.
2. Cross-provider PRICE (buy) vs SELL or IRR vs IRT, or timestamps separated beyond allowed skew, must be rejected, never auto-converted.
3. Even a failed notification HTTP attempt can have succeeded remotely; unknown network outcomes cannot be automatically retried as guaranteed-once sends.
4. A pure-function outbox cannot provide durable atomic compare-and-swap or make an exactly-once delivery guarantee across Worker instances. KV is eventually consistent and must not be used as sole atomic authority.
5. ATR is mathematically undefined from the existing 168 un-timestamped provider price-point arrays. Existing \`db/migrations/0005_navasan_private_daily_ohlc.sql\` remains blocked by licensing/unit/side rules.
6. A paper backtest's OHLC model cannot infer intrabar High/Low sequencing or actual execution fill, and the accepted licensed dataset is not presently available. No production strategy recommendation is permitted.
7. Historical outage root cause and Safari on-device root/app normal/private test matrix remain **تأییدنشده**. [PR #32](https://github.com/davoodmehraban89/VELYQOR/pull/32) stays unmerged.

## Definition of done for any eventual release

Evidence-backed real provider rights, quote side/unit and source timestamp; deterministic live v26 Worker source artifact; independent browser/device regression; transactional durable outbox and explicit user consent; measured end-to-end notification delivery; authoritative owner security review; three actual independent reviewers if required; zero P0 warnings; separate approval for merge and separately for production. None of those gates are implicitly waived by green domain tests.

**Conclusion:** isolated building blocks exist and are unit-testable; **the requested seven features are not complete or production-verified**. Do not mark as DONE; preserve both Draft PRs and stable Worker v26.
