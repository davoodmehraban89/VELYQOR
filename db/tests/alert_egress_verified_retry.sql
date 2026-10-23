-- Transactional CI-only test: after a provider-confirmed rejection the
-- next authorized lease must be able to consume a NEW one-send permit.
-- Ambiguous send and expired leases remain terminal, without duplicate POSTs.
BEGIN;

DO $$
DECLARE
  u UUID := 'b1111111-1111-4111-8111-111111111111';
  recipient UUID := 'b2222222-2222-4222-8222-222222222222';
  t0 TIMESTAMPTZ := '2026-10-22T12:00:00Z';
  one RECORD;
  two RECORD;
  no_claim RECORD;
  oid UUID;
  rejected TEXT;
  attempt_count INTEGER;
  old_started TIMESTAMPTZ;
  new_started TIMESTAMPTZ;
BEGIN
  IF current_database() <> 'velyqor_test' THEN
    RAISE EXCEPTION 'REFUSE_NON_EPHEMERAL_DATABASE';
  END IF;

  INSERT INTO public.app_users(id) VALUES (u);
  INSERT INTO public.alert_notification_consents(
    user_id,recipient_ref,channel,consented_at
  ) VALUES (u,recipient,'BALE',t0-interval '1 hour');

  oid := public.notification_outbox_enqueue(
    u,'explicit-rejection-and-safe-retry','BALE',recipient,2
  );

  SELECT * INTO one
  FROM public.alert_notification_claim_consented(t0,30);
  IF one.outbox_id IS DISTINCT FROM oid OR one.attempt_number <> 1 THEN
    RAISE EXCEPTION 'initial claim missing';
  END IF;
  IF NOT public.alert_notification_begin_egress(
    oid,one.claim_token,recipient,'BALE',t0+interval '1 second'
  ) THEN
    RAISE EXCEPTION 'initial one-time send permit denied';
  END IF;
  SELECT send_started_at INTO old_started
    FROM public.notification_outbox WHERE id=oid;
  IF old_started IS NULL THEN
    RAISE EXCEPTION 'first send permit not persisted';
  END IF;

  -- ONLY a definite, verified provider rejection authorizes future retry.
  rejected := public.notification_outbox_finish(
    oid,one.claim_token,'REJECTED',NULL,t0+interval '2 seconds',60
  );
  IF rejected <> 'FAILED' THEN
    RAISE EXCEPTION 'confirmed provider rejection not recorded';
  END IF;
  SELECT * INTO no_claim
  FROM public.alert_notification_claim_consented(t0+interval '40 seconds',30);
  IF no_claim.outbox_id IS NOT NULL THEN
    RAISE EXCEPTION 'confirmed rejection retried before cooldown';
  END IF;

  SELECT * INTO two
  FROM public.alert_notification_claim_consented(t0+interval '63 seconds',30);
  IF two.outbox_id IS DISTINCT FROM oid
    OR two.attempt_number <> 2
    OR two.claim_token = one.claim_token THEN
    RAISE EXCEPTION 'confirmed rejection did not yield fresh retry lease';
  END IF;
  SELECT send_started_at INTO new_started
    FROM public.notification_outbox WHERE id=oid;
  IF new_started IS NOT NULL THEN
    RAISE EXCEPTION 'previous single-send permit survived a legitimate retry lease';
  END IF;

  IF public.alert_notification_begin_egress(
    oid,one.claim_token,recipient,'BALE',t0+interval '64 seconds'
  ) THEN
    RAISE EXCEPTION 'previous worker token authorized second attempt';
  END IF;
  IF NOT public.alert_notification_begin_egress(
    oid,two.claim_token,recipient,'BALE',t0+interval '64 seconds'
  ) THEN
    RAISE EXCEPTION 'new lease could not obtain legitimate second permit';
  END IF;
  IF public.alert_notification_begin_egress(
    oid,two.claim_token,recipient,'BALE',t0+interval '64 seconds'
  ) THEN
    RAISE EXCEPTION 'same lease consumed two send permits';
  END IF;

  rejected := public.notification_outbox_finish(
    oid,two.claim_token,'REJECTED',NULL,t0+interval '65 seconds',60
  );
  IF rejected <> 'FAILED' THEN
    RAISE EXCEPTION 'second confirmed reject not recorded';
  END IF;

  SELECT * INTO no_claim
  FROM public.alert_notification_claim_consented(t0+interval '200 seconds',30);
  IF no_claim.outbox_id IS NOT NULL THEN
    RAISE EXCEPTION 'attempt limit bypass after repeated confirmed rejection';
  END IF;
  SELECT attempts INTO attempt_count
    FROM public.notification_outbox WHERE id=oid;
  IF attempt_count <> 2 THEN
    RAISE EXCEPTION 'attempt accounting incorrect';
  END IF;

  -- UNKNOWN does not become eligible for any new lease regardless of elapsed
  -- time and its old send_started_at remains as an audit marker.
  oid := public.notification_outbox_enqueue(
    u,'unknown-is-terminal','BALE',recipient,3
  );
  SELECT * INTO one
  FROM public.alert_notification_claim_consented(t0+interval '240 seconds',30);
  IF one.outbox_id IS DISTINCT FROM oid THEN
    RAISE EXCEPTION 'unknown test failed to claim';
  END IF;
  IF NOT public.alert_notification_begin_egress(
    oid,one.claim_token,recipient,'BALE',t0+interval '241 seconds'
  ) THEN
    RAISE EXCEPTION 'unknown test initial send permit unavailable';
  END IF;
  PERFORM public.notification_outbox_finish(
    oid,one.claim_token,'UNKNOWN',NULL,t0+interval '242 seconds'
  );
  SELECT * INTO no_claim
  FROM public.alert_notification_claim_consented(t0+interval '600 seconds',30);
  IF no_claim.outbox_id IS NOT NULL THEN
    RAISE EXCEPTION 'uncertain message was retried';
  END IF;
  SELECT send_started_at INTO old_started
    FROM public.notification_outbox WHERE id=oid;
  IF old_started IS NULL THEN
    RAISE EXCEPTION 'unknown outcome lost durable send-attempt marker';
  END IF;

  RAISE NOTICE 'ALERT_VERIFIED_RETRY_PERMIT_INVARIANTS_PASSED';
END $$;

ROLLBACK;
