# ADR-0003: Managed PostgreSQL Hosting Is Replaceable Infrastructure

Status: Accepted
Date: 2026-10-05

## Context
VELYQOR requires PostgreSQL, but the initial project must avoid foreign-payment dependencies. Supabase project capacity is constrained, Neon actions are not exposed in the current execution environment, and Render Free provisioning was observed to require payment credentials.

## Decision
- The product depends on PostgreSQL, not on a PostgreSQL hosting vendor.
- Runtime configuration exposes the database only as `DATABASE_URL` plus non-secret connection policy settings.
- Aiven Free PostgreSQL is the current initial hosting target if it can be provisioned without payment credentials.
- Hosting-provider SDKs, proprietary auth, proprietary realtime, and provider-specific SQL are prohibited from the core market domain.
- Cloudflare Hyperdrive may be introduced as a connection/edge optimization layer after a reachable PostgreSQL endpoint exists.
- Migrations remain plain PostgreSQL and versioned in the repository.

## Portability gate
Changing the managed PostgreSQL provider must not require changes to market symbols, pricing formulas, candle semantics, data-quality rules, or chart contracts.

## Consequences
Aiven, Neon, Supabase, Render, Railway, a VPS, or a future dedicated PostgreSQL cluster can be substituted without rewriting the product domain. Provider-specific operational configuration stays outside the domain layer.
