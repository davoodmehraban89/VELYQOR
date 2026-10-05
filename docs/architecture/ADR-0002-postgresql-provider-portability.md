# ADR-0002: PostgreSQL Provider Portability

Status: Accepted
Date: 2026-10-05

## Decision
VELYQOR's canonical database technology is PostgreSQL. Hosting provider identity is infrastructure configuration, not a domain dependency.

The application consumes a standard `DATABASE_URL`. Schema migrations must use portable PostgreSQL features unless an extension is separately approved by ADR. Provider SDKs must not leak into market-domain modules.

The initial managed provider may be Neon. Supabase, self-hosted PostgreSQL, or another compatible managed service can replace it without redesigning the market domain.

Cloudflare Hyperdrive may pool/accelerate PostgreSQL connections after a database exists; Hyperdrive is not the datastore itself.

## Consequences
- No Supabase-specific schema requirement.
- Auth is decoupled from core market data.
- Database migrations live in `db/migrations`.
- Secrets are supplied by runtime configuration and never committed.
- Provider migration remains operational rather than architectural work.
