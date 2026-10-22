-- All fixture rows and transitions are rolled back. This file runs only in
-- GitHub Actions ephemeral PostgreSQL, never in live Neon.
BEGIN;

DO $$
DECLARE
  u UUID := '11111111-1111-4111-8111-111111111111';
  r UUID := '22222222-2222-4222-8222-222222222222';
  other_u UUID := '33333333-3333-4333-8333-333333333333';
  t0 TIMESTAMPTZ := '2026-10-22T12:00:00Z';
  n UUID;
  dup UUID;
  n2 UUID;
  claimed RECORD;
  another RECORD;
  decision TEXT;
  attempts_actual INTEGER;
  current_status TEXT;
  accepted_id TEXT;
BEGIN
  INSERT INTO app_users(id) VALUES (u),(other_u);

  n := notification_outbox_enqueue(u,'event-1','BALE',r,2);
  dup := notification_outbox_enqueue(u,'event-1','BALE',r,2);
  IF n <> dup THEN RAISE EXCEPTION 'idempotent enqueue changed row ID'; END IF;
  SELECT count(*) INTO attempts_actual FROM notification_outbox
   WHERE user_id=u AND event_key='event-1';
  IF attempts_actual <> 1 THEN RAISE EXCEPTION 'duplicate event inserted'; END IF;

  BEGIN
    PERFORM notification_outbox_enqueue(u,'', 'BALE',r,2);
    RAISE EXCEPTION 'blank event accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM notification_outbox_enqueue(u,'event-2','TELEGRAM',r,2);
    RAISE EXCEPTION 'unapproved channel accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  SELECT * INTO claimed FROM notification_outbox_claim(t0,30);
  IF claimed.outbox_id <> n OR claimed.attempt_number <> 1
    OR claimed.claim_token IS NULL THEN
    RAISE EXCEPTION 'claim did not return exact unique lease';
  END IF;
  SELECT * INTO another FROM notification_outbox_claim(t0,30);
  IF another.outbox_id IS NOT NULL THEN
    RAISE EXCEPTION 'concurrent/in-flight claim returned already leased row';
  END IF;
  decision := notification_outbox_finish(n,gen_random_uuid(),
    'SENT','msg-1',t0 + interval '5 seconds');
  IF decision <> 'IGNORED_STALE_OR_INELIGIBLE' THEN
    RAISE EXCEPTION 'wrong lease token completed another worker claim';
  END IF;
  BEGIN
    PERFORM notification_outbox_finish(n,claimed.claim_token,
      'SENT',NULL,t0 + interval '5 seconds');
    RAISE EXCEPTION 'provider acceptance without message ID allowed';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  decision := notification_outbox_finish(n,claimed.claim_token,
    'SENT','provider-accepted-id',t0 + interval '5 seconds');
  IF decision <> 'SENT' THEN RAISE EXCEPTION 'verified send failed'; END IF;
  decision := notification_outbox_finish(n,claimed.claim_token,
    'SENT','provider-accepted-id',t0 + interval '6 seconds');
  IF decision <> 'IGNORED_STALE_OR_INELIGIBLE' THEN
    RAISE EXCEPTION 'duplicate send completion succeeded';
  END IF;
  SELECT status,provider_message_id INTO current_status,accepted_id
    FROM notification_outbox WHERE id=n;
  IF current_status <> 'SENT' OR accepted_id <> 'provider-accepted-id' THEN
    RAISE EXCEPTION 'provider receipt not durable';
  END IF;

  IF notification_outbox_acknowledge(n,other_u,t0 + interval '7 seconds') THEN
    RAISE EXCEPTION 'cross-user acknowledgement succeeded';
  END IF;
  IF notification_outbox_acknowledge(n,u,t0) THEN
    RAISE EXCEPTION 'acknowledgement before send accepted';
  END IF;
  IF NOT notification_outbox_acknowledge(n,u,t0 + interval '8 seconds') THEN
    RAISE EXCEPTION 'explicit user acknowledgement failed';
  END IF;
  IF notification_outbox_acknowledge(n,u,t0 + interval '9 seconds') THEN
    RAISE EXCEPTION 'duplicate acknowledgement succeeded';
  END IF;
  SELECT status INTO current_status FROM notification_outbox WHERE id=n;
  IF current_status <> 'ACKNOWLEDGED' THEN
    RAISE EXCEPTION 'message ACK state not persisted';
  END IF;

  -- Explicit provider rejection is the ONLY automatic retry-eligible outcome.
  n2 := notification_outbox_enqueue(u,'event-2','BALE',r,2);
  SELECT * INTO claimed FROM notification_outbox_claim(t0 + interval '1 minute',30);
  IF claimed.outbox_id <> n2 THEN RAISE EXCEPTION 'unexpected retry target'; END IF;
  decision := notification_outbox_finish(n2,claimed.claim_token,
    'REJECTED',NULL,t0 + interval '65 seconds',60);
  IF decision <> 'FAILED' THEN RAISE EXCEPTION 'explicit reject incorrect'; END IF;

  SELECT * INTO another FROM notification_outbox_claim(t0 + interval '90 seconds',30);
  IF another.outbox_id IS NOT NULL THEN RAISE EXCEPTION 'retry occurred too early'; END IF;
  SELECT * INTO claimed FROM notification_outbox_claim(t0 + interval '126 seconds',30);
  IF claimed.outbox_id <> n2 OR claimed.attempt_number <> 2 THEN
    RAISE EXCEPTION 'retry after verified rejection failed';
  END IF;
  decision := notification_outbox_finish(n2,claimed.claim_token,
    'UNKNOWN',NULL,t0 + interval '130 seconds');
  IF decision <> 'UNKNOWN' THEN RAISE EXCEPTION 'ambiguous send not terminal'; END IF;
  SELECT * INTO another FROM notification_outbox_claim(t0 + interval '3 minutes',30);
  IF another.outbox_id IS NOT NULL THEN
    RAISE EXCEPTION 'unknown outcome retried despite duplicate-send risk';
  END IF;

  -- Crash after transport attempt but before outcome saved: lease expires,
  -- record becomes UNKNOWN; NEVER claim again without manual reconciliation.
  n2 := notification_outbox_enqueue(u,'event-3','BALE',r,3);
  SELECT * INTO claimed FROM notification_outbox_claim(t0 + interval '4 minutes',30);
  IF claimed.outbox_id <> n2 THEN RAISE EXCEPTION 'lease test wrong event'; END IF;
  SELECT * INTO another FROM notification_outbox_claim(t0 + interval '5 minutes',30);
  IF another.outbox_id IS NOT NULL THEN
    RAISE EXCEPTION 'crashed in-flight message re-claimed';
  END IF;
  SELECT status INTO current_status FROM notification_outbox WHERE id=n2;
  IF current_status <> 'UNKNOWN' THEN
    RAISE EXCEPTION 'expired in-flight lease did not turn UNKNOWN';
  END IF;
  IF notification_outbox_finish(n2,claimed.claim_token,'SENT','late',
     t0 + interval '5 minutes') <> 'IGNORED_STALE_OR_INELIGIBLE' THEN
    RAISE EXCEPTION 'late worker modified unknown outcome';
  END IF;

  -- DB constraint enforcement: cannot forge received state without evidence.
  BEGIN
    UPDATE notification_outbox SET status='SENT'
    WHERE id=n2;
    RAISE EXCEPTION 'SENT without provider receipt bypassed SQL constraint';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE notification_outbox SET status='LEASED' WHERE id=n2;
    RAISE EXCEPTION 'LEASED without lease token bypassed SQL constraint';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Idempotency scoped per user: no leakage between two users.
  dup := notification_outbox_enqueue(other_u,'event-1','BALE',r,2);
  IF dup = n THEN RAISE EXCEPTION 'user-scoped idempotency violated'; END IF;

  -- SQL permissions do not grant anonymous read or execution.
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee='PUBLIC' AND table_name='notification_outbox'
  ) THEN
    RAISE EXCEPTION 'unexpected PUBLIC table privilege';
  END IF;

  -- PostgreSQL grants EXECUTE on newly created functions to PUBLIC unless
  -- explicitly revoked; check each privileged outbox function.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc AS p
    JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))
    ) AS acl
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'notification_outbox_enqueue',
        'notification_outbox_claim',
        'notification_outbox_finish',
        'notification_outbox_acknowledge'
      )
      AND acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'outbox function EXECUTE unexpectedly available to PUBLIC';
  END IF;
END $$;

ROLLBACK;
