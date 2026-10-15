# Provider Source Matrix — Phase 1 Data Proof

> **HISTORICAL / 2026-10-05 candidate matrix.** This file records development-era Navasan, Bon-bast and Alpha Vantage candidates, **not confirmed live ChartNova data provenance**. For up-to-date official-plan observations, licensing restrictions, vendor links, unknowns and Gheymat Online/TGJU/BrsApi/Gold API see [official-source review 2026-10-15](provider-source-matrix-2026-10-15.md). For recorded Worker/PR divergence see [Stage-1 reconciliation](../operations/chartnova-stage1-production-reconciliation-2026-10-15.md). No provider is approved by this documentary note.

Research date: 2026-10-05

This matrix is an engineering gate, not a provider endorsement. A provider is not promoted to production solely because an API is reachable. Licensing/commercial rights, timestamp quality, update frequency, history, reliability, and reproducibility must all be acceptable.

## Canonical symbols

| Canonical symbol | Needed for MVP | Data requirement |
|---|---:|---|
| USD_IRT_FREE | Yes | Iranian free-market USD/IRT, timestamped observations |
| GOLD18_IRT | Yes | Iranian 18K gold/IRT, timestamped observations |
| XAU_USD | Yes | Global gold spot USD/troy ounce |
| GOLD18_THEORETICAL_IRT | Derived | Calculated internally |
| GOLD18_PREMIUM_IRT | Derived | Calculated internally |
| GOLD18_PREMIUM_PCT | Derived | Calculated internally |

## Current candidates

### Navasan
Official source: https://www.navasan.tech/en/api

Observed capabilities:
- Iranian currency prices in IRR.
- Latest rates and historical updates.
- Historical OHLC is documented.
- Free tier currently advertises 120 calls/month and update rate every two hours.
- Paid Standard tier advertises instantaneous updates with higher call limits.

Engineering ruling:
- Suitable for schema/integration proof and possibly low-frequency reference/backfill.
- Free tier is NOT sufficient for a genuine 1-minute/live chart.
- Never expose a 1m timeframe from this source alone.
- Commercial use/plan terms must be confirmed before production dependency.

Candidate role:
REFERENCE / DEVELOPMENT PROOF

### Bon-bast
Official docs: https://www.bon-bast.com/docs

Observed capabilities:
- Near-real-time Iran open-market FX plus gold/silver/coin.
- Historical data is advertised.
- Bon-bast states its displayed rates are in toman.
- Official commercial API is paid; current Basic plan is advertised at USD 469/year with 10,000 API calls/month.
- The service explicitly directs businesses to its API for commercial use.

Engineering ruling:
- Strong production candidate from a licensing/official-API perspective if/when budget is approved.
- Does not satisfy the current zero-foreign-spend MVP constraint.
- Do not scrape the public site as a substitute for commercial API rights.

Candidate role:
FUTURE PRODUCTION / COMMERCIAL REFERENCE

### Alpha Vantage — XAU/USD
Official docs: https://www.alphavantage.co/documentation/

Observed capabilities:
- Dedicated Gold & Silver Spot endpoint.
- Historical gold/silver daily/weekly/monthly endpoint.
- Free API keys are offered.
- Suitable as an immediately testable global-XAU source, subject to actual free quota and freshness observed during Data Proof.

Engineering ruling:
- Good initial XAU/USD candidate for development and validation.
- Production/live suitability must be measured, not assumed.
- If free quota/frequency is insufficient for desired chart resolution, replace behind the provider adapter without domain changes.

Candidate role:
PRIMARY DEVELOPMENT CANDIDATE FOR XAU_USD

## Rejected assumptions

- Binance market streams are useful for crypto/futures streams, but they are not adopted here as the canonical XAU/USD source without explicit evidence for the required spot-gold instrument.
- Unofficial scrapers/wrappers are not production truth sources.
- A source that updates every two hours cannot truthfully support a 1m candle.
- Missing observations are not synthesized into fake ticks.

## Selection gates

A provider can become PRIMARY only after all applicable gates pass:

1. Legal/commercial usage path is documented.
2. Unit convention is explicit (IRR vs IRT, gram vs ounce, purity).
3. Provider timestamp is present or a documented receive-time fallback is used.
4. Update frequency is measured over a continuous test window.
5. Duplicate/out-of-order behavior is measured.
6. Outage/recovery behavior is known.
7. Historical depth and OHLC semantics are verified if used for backfill.
8. Cross-provider divergence can be observed where a reference source exists.
9. Credentials are server-side only.
10. The UI exposes only timeframes justified by observed source frequency.

## Current Phase 1 source plan

USD_IRT_FREE:
- Navasan as immediate integration/reference candidate.
- Bon-bast retained as future commercial-quality candidate.
- Continue searching for a second zero-cost legally usable reference before calling the source stack resilient.

GOLD18_IRT:
- Evaluate Navasan's gold instruments/units in the same proof harness.
- Bon-bast retained as future commercial candidate.
- Reject any source whose gold definition (18K / mesghal / ounce / rial/toman) is ambiguous.

XAU_USD:
- Implement Alpha Vantage adapter first for proof.
- Measure actual freshness/quota.
- Keep adapter replaceable.

## Exit condition for provider selection

No provider is marked production-ready in this document yet.
Phase 1 Data Proof exits only when USD_IRT_FREE, GOLD18_IRT, and XAU_USD each have a tested ingestion path with observed timestamps, units, freshness, failure behavior, and documented usage constraints.
