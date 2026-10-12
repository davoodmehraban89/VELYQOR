# ChartNova GitHub Actions — pre-run failure investigation

Observed: 2026-10-12; workflow `.github/workflows/ci.yml`; open draft PR #24.

## Verified API evidence

Workflow run: https://github.com/davoodmehraban89/VELYQOR/actions/runs/38198123692

Direct GitHub REST `GET /repos/davoodmehraban89/VELYQOR/actions/runs/38198123692/jobs?per_page=100` returned:

| Job | Status | Conclusion | Started UTC | Completed UTC | Runner name | Steps |
|---|---|---|---|---|---|---|
| `verify` | completed | failure | 2026-10-12 03:01:38 | 03:01:41 | empty string | empty array |
| `postgres-invariants` | completed | failure | 2026-10-12 03:01:38 | 03:01:41 | empty string | empty array |

**Both jobs failed before any workflow step ran or runner was assigned.** Therefore this run is **not evidence that `pnpm install`, `pnpm verify`, migrations, PostgreSQL invariants, Node code, or SQL assertions actually failed.** This does not prove the code will pass on a functioning runner.

Requests to download both job logs via the connected GitHub API previously returned HTTP 404 with `BlobNotFound`. This is consistent with jobs that never executed steps, but it does not identify the exact platform/account restriction.

## Hypotheses to check (NOT established causes)

- Organization/repository GitHub Actions policy and allowed runners.
- GitHub Actions usage quota, account billing/spending limit, or payment status for private repositories.
- Temporary GitHub-hosted runner scheduling/provisioning problems.
- Repository Actions permissions or administrative restrictions.

Do not change tests to pretend they passed or use `continue-on-error` on the jobs. CI remains a release blocker.

## Administrative steps

A repository administrator should review the *warning banner / annotation* on the affected GitHub Actions run and visit repository **Settings → Actions → General** and account **Settings → Billing and licensing → Usage/Budgets** (exact labels may differ). Note the precise pre-run failure reason without sharing tokens or billing credentials. If it is a transient runner-side incident, rerun the jobs once and inspect their newly assigned runner/steps.

If the issue is account billing/limits or action policy, resolve it in the GitHub UI. This project cannot safely change account billing or Actions policy through a source commit, and no such settings were changed here.

## Independent verification still available

- Latest isolated local source tests in previous checkpoint: 126 domain/market-feed tests and 18 Worker/history tests passed.
- Standalone React/Vite production build and Worker syntax checks passed.
- These results do not replace a real PostgreSQL 18 service and Linux CI run, nor do they verify live Worker→Neon credentials, market licensing, or a deployed Durable Object.

## Required exit conditions

1. Both GitHub Actions jobs start with non-empty `runner_name` and executed `steps`.
2. Any actual failing step's log is obtained and corrected in source.
3. Both `verify` and `postgres-invariants` finish successfully on the reviewed head SHA.
4. Manual release gate still checks licensed OHLC, secure Neon secret, staging WSS and data/latency correctness.

**No production changes, spending, provider enrollment or credentials were made during this diagnosis.**
