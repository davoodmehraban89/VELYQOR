# Canonical Market Data Contracts

## Canonical instruments

| Symbol | Class | Market | Canonical unit |
|---|---|---|---|
| `USD_IRT_FREE` | FX | Iran free market | IRT per USD |
| `GOLD18_IRT` | Commodity | Iran | IRT per gram 18K |
| `XAU_USD` | Commodity | Global spot | USD per troy ounce |
| `GOLD18_THEORETICAL_IRT` | Derived | VELYQOR | IRT per gram 18K |
| `GOLD18_PREMIUM_IRT` | Derived | VELYQOR | IRT per gram 18K |
| `GOLD18_PREMIUM_PCT` | Derived | VELYQOR | percent |

Provider symbols are mappings and must never replace canonical symbols.

## Units
- Iran-facing canonical currency unit for MVP: toman (`IRT`).
- Provider rial values must be normalized in the provider adapter; the raw provider value remains auditable.
- 1 troy ounce = 31.1034768 grams.
- 18K purity factor = 0.75.

## Theoretical 18K gold

`gold18_theoretical_irt = (xau_usd / 31.1034768) * 0.75 * usd_irt_free`

Premium absolute:

`premium_irt = gold18_market_irt - gold18_theoretical_irt`

Premium percentage:

`premium_pct = (gold18_market_irt / gold18_theoretical_irt - 1) * 100`

## Time contract
- Canonical backend/database timestamps: UTC.
- Iran presentation timezone: `Asia/Tehran`.
- Provider timestamp and receive timestamp are separate fields.
- Raw provider timestamp is retained where available.
- Derived calculations align source observations to a target timestamp and record the selected source timestamps.

## Derived-value provenance
Every derived value must retain at least:
- target timestamp
- XAU/USD value and timestamp
- USD/IRT value and timestamp
- formula/calculation version
- quality status/score
- staleness/quality flags

## Quality states
Minimum semantic states:
- `GOOD`
- `DEGRADED`
- `STALE`
- `INVALID`

A `STALE` or `INVALID` observation must not be rendered as healthy live data.

## Candle invariants
For every candle:
- `low <= open <= high`
- `low <= close <= high`
- `open_time < close_time`
- unique `(instrument, timeframe, open_time)`
- candle/session boundaries use the relevant market calendar rather than blindly assuming UTC midnight.

## Initial timeframes
Candidate timeframes are `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d`. A timeframe is exposed in UI only when source frequency and quality genuinely support it.
