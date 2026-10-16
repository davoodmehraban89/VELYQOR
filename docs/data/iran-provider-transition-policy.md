# Iranian market data provider transition policy

Decision date: 2026-10-10

- **Development / initial release target:** Gheymat Online free API (advertised 250 requests/day), subject to validating authentication, exact symbol coverage, real response shape, freshness, terms and actual quota. Do not cut over until live tests pass.
- **Future paid production target:** Navasan paid API, chosen by the project owner as the more economical paid upgrade path. Before migration, recheck pricing, licensed usage, limits, uptime and data quality; do not buy without explicit approval.
- **Current state:** Navasan free remains the working Iranian provider until Gheymat Online is integrated and validated. Navasan free's 120 monthly requests are inadequate for continuous operation.
- **Architecture:** Keep USD_IRT_FREE and GOLD18_IRT canonical symbols, provider-neutral observation contracts, and pluggable adapters; select providers through configuration, not UI or database schema changes. Keep rollback to the last working provider.
- **Acceptance for each cutover:** verified real USD and 18K gold samples; correct units and timestamps; freshness, duplicate, gap and quota tests; error handling and provider failover; usage-rights review. A one-sample smoke test is not a production quality proof.
