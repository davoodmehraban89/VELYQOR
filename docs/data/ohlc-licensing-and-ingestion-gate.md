# ChartNova — source OHLC licensing and ingestion quality gate

Status: **Implemented preflight + unit tests; NOT a live OHLC importer, legal license, deployed feed, or trading signal.**  
Repository branch: `feature/chartnova-neon-direct-history`

## Current source-of-truth rules
1. ECB EXR observations remain in `market_ticks` with `data_kind=daily_reference_point_not_ohlc`; they must **never** enter `candles`. One valid daily rate is not a high/low/open/close.
2. The existing `candles` table was directly checked and remains empty pending genuinely licensed source OHLC.
3. The Navasan public API guide documents `ohlcSearch` for daily source OHLC (USD Tehran sell, 18K gold and coin, among others), but the publicly retrieved guide **does not establish commercial archival / public redistribution permission**. Obtain the provider's commercial terms/permission before enabling import. No Navasan data was inserted.
4. TGJU historical OHLC licensing is unresolved and must not be ingested without documented authorization. Crypto/exchange sources likewise need provider-specific scope and network/API verification.

## Implemented contract
`packages/market-domain/src/licensed-ohlc-history.mjs` provides `preflightOhlcHistory` for a candidate batch. Inputs include:
- Canonical `symbol`, exact `providerCode`, `timeframe=1d`, declared `rawUnit`, `canonicalUnit`, an IANA `timeZone`, UTC-offset-bearing `openTime`/`closeTime`, and exchange `sessionDate`.
- Explicit `dataKind=source_ohlc`, four provider OHLC values and optional source volume; absent volume remains `null` (not invented zero).
- A separately reviewed license manifest: `status=approved`, `reviewedBy`, `reviewedAt`, `evidenceRef`, `providerCode` and `rights.commercialStorage`; public APIs additionally require `rights.publicRedistribution`. This gate **validates the provided license metadata; it cannot itself certify that the legal document is authentic**. Maintain signed provider contracts outside the public/code repository and only a non-secret evidence reference in GitHub.
- Exact fixed base-10 string normalization for recognized units (currently IRR→IRT /10 for USD and gold 18K), with no implicit buy/sell or gram/ounce conversion. Any unapproved unit pair is rejected.
- Timestamp/price validity, OHLC order, deduplication of exactly matching observations, conflict rejection, and out-of-order counting.
- Optional independently verified exchange session calendar `isSessionDay`. Gap reporting does not synthesize sessions. No public annual publication readiness without a real calendar, a 365+ **date span**, zero missing expected sessions across the **entire requested window**, zero unexpected closed sessions, and zero conflicting/out-of-order observations.
- Preflight marks candidate bars `DEGRADED` with reason `source_ohlc_not_cross_verified`; it does not declare market/source truth or invent a positive quality score.

## Outstanding production requirements
- Legal review/evidence for each provider (storage, public display, attribution, derived metrics, retention, redistribution and API sublicensing); do not equate possession of an API key with redistribution rights.
- Licensed provider adapter and validation of real payload response / rate limit / timestamp semantics; no samples or test fixtures are production data.
- Auditable immutable raw observation + normalized OHLC staging in a transaction, mapping to `instruments` and `providers`, with an idempotent unique key. The current `candles` table cannot store provider license/source attribution on its own: add provenance linkage or a separate source-observation record before live OHLC import.
- Exchange calendar confirmed against Iranian session trading schedules and closures; implement quarantine/manual review for spike/outlier/OHLC revisions.
- At least one independently validated year of each *requested* instrument; ECB rates do not satisfy Iranian market one-year OHLC requirements.
- Technical indicator and prediction backtesting must account for candle availability, warmup periods, data revisions, look-ahead and survivorship biases, train/test temporal splits, and uncertainty; do not represent model outputs as certainty.

## Verified local tests (test fixtures only)
- Domain suite: **85/85 PASS** via `npm test`.
- Worker/history tests: **14/14 PASS** with `node --test deploy/chartnova/history-ui-sync.test.mjs deploy/chartnova/history-security.test.mjs deploy/chartnova/history-direct.test.mjs deploy/chartnova/history-endpoints.test.mjs`.
- Worker syntax: `node --check deploy/chartnova/worker.mjs` PASS.
- These are local/isolated-branch results. They do **not** establish a deployed direct Worker-Neon authenticated query or a licensed annual OHLC dataset.

## Rollback
The new validator is not wired into live ingestion. Revert its commits / omit the validator module without touching the existing Neon tables or the deployed ECB-KV history. Existing user's dirty local worktree and pending `0005_navasan_private_daily_ohlc.sql` are intentionally not overwritten.

## Sources for humans to verify license scope
- Navasan official webservice guide: https://www.navasan.tech/webserviceguide/
- ECB public EXR methodology: https://www.ecb.europa.eu/stats/exchange_rates/html/index.en.html

## Independent audit finding — local, uncommitted migration
A read-only inspection of the user's existing **untracked** `db/migrations/0005_navasan_private_daily_ohlc.sql` found its provider mapping sets `raw_unit` to `IRT`, whereas the committed Navasan adapter `packages/market-domain/src/adapters/navasan.mjs` declares `IRR_PER_USD` / `IRR_PER_GRAM` and divides input prices by ten. Those assumptions must be reconciled against a provider-supplied unit contract and actual response before any DB migration/import. Do **not** infer from a price's magnitude whether it is IRR or IRT. The untracked migration was **not modified or executed**; there is no new public Navasan view.
