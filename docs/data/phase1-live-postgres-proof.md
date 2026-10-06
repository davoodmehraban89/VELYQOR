# Phase 1 Live PostgreSQL Proof — Neon

Date: 2026-10-07

## Scope

This record captures the external PostgreSQL acceptance evidence for Phase 1. Credentials and connection strings are intentionally excluded.

## Environment

- Provider: Neon
- Project: VELYQOR
- Branch: production
- Database: neondb
- Role: neondb_owner
- Engine observed: PostgreSQL 18.6
- Transport: TLS connection
- Application credential source: local runtime-only `.env.local`
- Repository secret exposure: none

## Live execution result

Connection to the reachable Neon PostgreSQL endpoint succeeded.

Applied migrations, in lexical order:

1. `0001_market_core.sql` — PASS
2. `0002_workspaces.sql` — PASS
3. `0003_phase1_persistence_hardening.sql` — PASS

Executed database invariant suites:

1. `market_core_invariants.sql` — PASS
2. `phase1_persistence_invariants.sql` — PASS

Post-execution verification:

- Canonical instruments: 6
- Public tables: 11
- Invalid OHLC rejection: verified
- Duplicate canonical tick rejection: verified
- Future provider timestamp rejection: verified
- Test transaction rollback behavior: verified

## Domain regression

Local market-domain regression suite executed after the live database proof:

- Tests: 66
- Passed: 66
- Failed: 0

## Acceptance impact

Phase 1 exit gate 1 is satisfied: PostgreSQL migrations and invariants execute successfully against a live reachable PostgreSQL instance.

Remaining external provider gates are not satisfied yet because `NAVASAN_API_KEY` and `ALPHAVANTAGE_API_KEY` are not present in the runtime. No provider result is claimed without those credentials.
