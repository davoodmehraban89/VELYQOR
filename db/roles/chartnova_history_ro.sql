-- ChartNova: reconstruct the *least-privilege* ECB history reader only.
-- Intentionally does NOT recreate privileged legacy role chartnova_history_reader.
-- NOT an auto-run migration. Execute only after an authorized review in the target Neon database.
-- Secret/password is never stored in GitHub. NOLOGIN is deliberate until secure activation.
DO $chartnova$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'chartnova_history_ro') THEN
    CREATE ROLE chartnova_history_ro
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOREPLICATION NOBYPASSRLS NOINHERIT;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname='chartnova_history_ro'
      AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolinherit)
  ) THEN
    RAISE EXCEPTION 'chartnova_history_ro has excessive privileges; halt and review';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member
    WHERE r.rolname='chartnova_history_ro'
  ) THEN
    RAISE EXCEPTION 'chartnova_history_ro inherits a role; halt and review';
  END IF;
END
$chartnova$;
GRANT USAGE ON SCHEMA public TO chartnova_history_ro;
GRANT SELECT ON TABLE public.chartnova_history_public TO chartnova_history_ro;
-- Do not grant privileges on market_ticks, candles, providers, instruments, or other tables.
-- Enabling LOGIN and provisioning Cloudflare secret require a separate, secure authorization.
