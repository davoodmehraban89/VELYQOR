-- Disposable CI PostgreSQL only: no production Neon writes.
BEGIN;

DO $$
DECLARE
  v_user UUID := 'f1111111-1111-4111-8111-111111111111';
  v_other UUID := 'f2222222-2222-4222-8222-222222222222';
  v_recipient UUID := 'f3333333-3333-4333-8333-333333333333';
  t TIMESTAMPTZ := '2026-10-22 12:00:00+00';
  before_state JSONB;
  crossed_state JSONB;
  result RECORD;
  event_id TEXT := 'threshold1:2026-10-22T12:01:00.000Z:0';
  n INTEGER;
  current_status TEXT;
BEGIN
  INSERT INTO public.app_users(id) VALUES (v_user),(v_other);

  before_state := jsonb_build_object('alert',jsonb_build_object(
    'id','threshold1','phase','ARMED',
    'lastTimestamp','2026-10-22T12:00:00.000Z',
    'highWater',1000,
    'consecutive',0));
  crossed_state := jsonb_build_object('alert',jsonb_build_object(
    'id','threshold1','phase','TRIGGERED',
    'lastTimestamp','2026-10-22T12:01:00.000Z',
    'triggeredAt','2026-10-22T12:01:00.000Z',
    'eventId',event_id,
    'highWater',1100,
    'consecutive',1),
    'gate',jsonb_build_object(
      'suspended',false,
      'lastSampleAt','2026-10-22T12:01:00.000Z',
      'lastAccepted',jsonb_build_object(
        'timestamp','2026-10-22T12:01:00.000Z',
        'provider','S1',
        'symbol','USD_IRT_FREE',
        'side','SELL',
        'unit','IRT_PER_USD',
        'price',1100
      )
    ));

  -- Safe rule-state writes require no user notification at all.
  SELECT * INTO result FROM public.alert_rule_commit(v_user,'threshold1',0,
    before_state,NULL,NULL,NULL,t);
  IF result.outcome <> 'STATE_SAVED' OR result.new_revision <> 1
    OR result.outbox_id IS NOT NULL THEN
    RAISE EXCEPTION 'initial safe state CAS did not commit as expected';
  END IF;

  -- Client that read old revision 0 cannot replace revision 1.
  SELECT * INTO result FROM public.alert_rule_commit(v_user,'threshold1',0,
    crossed_state,event_id,'BALE',v_recipient,t+interval '1 minute');
  IF result.outcome <> 'STALE_REVISION' OR result.new_revision <> 1 THEN
    RAISE EXCEPTION 'stale-version write overwrote durable state';
  END IF;

  -- Even an otherwise valid alert cannot enqueue without current consent.
  BEGIN
    PERFORM * FROM public.alert_rule_commit(v_user,'threshold1',1,
      crossed_state,event_id,'BALE',v_recipient,t+interval '1 minute');
    RAISE EXCEPTION 'unconsented notification was queued';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  SELECT count(*) INTO n FROM public.notification_outbox
   WHERE user_id=v_user;
  IF n <> 0 THEN RAISE EXCEPTION 'failed consent check left message in outbox'; END IF;
  SELECT revision INTO n FROM public.alert_rule_runtime
   WHERE user_id=v_user AND rule_key='threshold1';
  IF n <> 1 THEN RAISE EXCEPTION 'failed consent check changed runtime revision'; END IF;

  INSERT INTO public.alert_notification_consents
    (user_id,recipient_ref,channel,consented_at)
  VALUES (v_user,v_recipient,'BALE',t-interval '10 minutes');
  -- Simulate a forged trigger with a suspended quality gate. It must not
  -- create any outbox record or advance revision even with valid consent.
  BEGIN
    PERFORM * FROM public.alert_rule_commit(v_user,'threshold1',1,
      jsonb_set(crossed_state,'{gate,suspended}','true'::jsonb),
      event_id,'BALE',v_recipient,t+interval '1 minute');
    RAISE EXCEPTION 'suspended gate enqueued an informational alert';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  SELECT count(*) INTO n FROM public.notification_outbox WHERE user_id=v_user;
  IF n <> 0 THEN RAISE EXCEPTION 'suspended gate wrote outbox'; END IF;


  -- Two changes happen in the SAME SQL transaction, no write half-completion.
  SELECT * INTO result FROM public.alert_rule_commit(v_user,'threshold1',1,
    crossed_state,event_id,'BALE',v_recipient,t+interval '1 minute');
  IF result.outcome <> 'TRIGGERED_ENQUEUED'
    OR result.new_revision <> 2 OR result.outbox_id IS NULL THEN
    RAISE EXCEPTION 'trigger/enqueue was not atomic';
  END IF;

  SELECT count(*) INTO n FROM public.notification_outbox AS o
  WHERE o.user_id=v_user AND o.event_key=event_id
    AND o.status='PENDING' AND o.recipient_ref=v_recipient;
  IF n <> 1 THEN RAISE EXCEPTION 'trigger enqueue did not create one row'; END IF;

  SELECT count(*) INTO n FROM public.alert_rule_runtime AS r
  WHERE r.user_id=v_user AND r.rule_key='threshold1'
    AND r.last_event_key=event_id AND r.revision=2
    AND r.state #>> '{alert,phase}'='TRIGGERED';
  IF n <> 1 THEN RAISE EXCEPTION 'trigger state not saved with event'; END IF;

  -- No automatic re-arming or duplicate OCO event from another Worker.
  SELECT * INTO result FROM public.alert_rule_commit(v_user,'threshold1',2,
    crossed_state,event_id,'BALE',v_recipient,t+interval '1 minute');
  IF result.outcome <> 'ALREADY_TERMINAL' OR result.new_revision <> 2 THEN
    RAISE EXCEPTION 'duplicate event was not rejected';
  END IF;
  SELECT count(*) INTO n FROM public.notification_outbox WHERE event_key=event_id;
  IF n <> 1 THEN RAISE EXCEPTION 'duplicate outbox message created'; END IF;

  -- Consent may be revoked AFTER an informational alert was queued.
  -- The future sender must never receive the previously queued message.
  UPDATE public.alert_notification_consents
    SET revoked_at = t + interval '2 minutes'
  WHERE user_id=v_user AND recipient_ref=v_recipient AND channel='BALE';

  SELECT count(*) INTO n
    FROM public.alert_notification_claim_consented(t+interval '3 minutes',30);
  IF n <> 0 THEN RAISE EXCEPTION 'revoked recipient was returned to sender'; END IF;
  SELECT status INTO current_status FROM public.notification_outbox
    WHERE user_id=v_user AND event_key=event_id;
  IF current_status <> 'UNKNOWN' THEN
    RAISE EXCEPTION 'revoked queued message not terminally suppressed';
  END IF;
  SELECT count(*) INTO n
    FROM public.alert_notification_claim_consented(t+interval '4 minutes',30);
  IF n <> 0 THEN RAISE EXCEPTION 'revoked notification was re-claimed'; END IF;

  -- Active opt-in remains retrievable only through the consent-aware claim.
  INSERT INTO public.alert_notification_consents
    (user_id,recipient_ref,channel,consented_at)
  VALUES(v_other,v_recipient,'BALE',t-interval '10 minutes');
  PERFORM public.notification_outbox_enqueue(v_other,'consented-alert',
    'BALE',v_recipient,3);
  SELECT * INTO result
    FROM public.alert_notification_claim_consented(t+interval '5 minutes',30);
  IF result.event_key <> 'consented-alert' OR result.claim_token IS NULL THEN
    RAISE EXCEPTION 'consented claimant did not receive authorized pending event';
  END IF;
  IF public.alert_notification_egress_allowed(
      result.outbox_id, result.claim_token, v_recipient,'BALE', t+interval '5 minutes 1 second') THEN
    RAISE EXCEPTION 'unconsumed send permit bypassed egress gate';
  END IF;
  IF public.alert_notification_begin_egress(
      result.outbox_id, result.claim_token, gen_random_uuid(),'BALE',
      t+interval '5 minutes 1 second') THEN
    RAISE EXCEPTION 'foreign recipient reference obtained send permission';
  END IF;
  IF public.alert_notification_begin_egress(
      result.outbox_id, result.claim_token, v_recipient,'EITA',
      t+interval '5 minutes 1 second') THEN
    RAISE EXCEPTION 'wrong channel obtained Bale message send permission';
  END IF;
  IF NOT public.alert_notification_begin_egress(
      result.outbox_id, result.claim_token, v_recipient,'BALE', t+interval '5 minutes 1 second') THEN
    RAISE EXCEPTION 'first valid send permit not issued';
  END IF;
  IF public.alert_notification_begin_egress(
      result.outbox_id, result.claim_token, v_recipient,'BALE', t+interval '5 minutes 2 seconds') THEN
    RAISE EXCEPTION 'repeated send permit enabled duplicate outbound message';
  END IF;
  IF NOT public.alert_notification_egress_allowed(
      result.outbox_id, result.claim_token, v_recipient,'BALE', t+interval '5 minutes 2 seconds') THEN
    RAISE EXCEPTION 'single-use permit did not authorize legitimate egress';
  END IF;
  IF public.alert_notification_egress_allowed(
      result.outbox_id, gen_random_uuid(), v_recipient,'BALE', t+interval '5 minutes 1 second') THEN
    RAISE EXCEPTION 'wrong lease token authorized message egress';
  END IF;
  IF public.alert_notification_egress_allowed(
      result.outbox_id, result.claim_token, v_recipient,'BALE', t+interval '6 minutes') THEN
    RAISE EXCEPTION 'expired lease permitted message egress';
  END IF;
  PERFORM public.notification_outbox_finish(result.outbox_id,result.claim_token,
    'UNKNOWN',NULL,t+interval '5 minutes 5 seconds');

  -- A revoked oldest message must not starve a valid queued notification.
  PERFORM public.notification_outbox_enqueue(v_user,'revoked-oldest',
    'BALE',v_recipient,3);
  PERFORM public.notification_outbox_enqueue(v_other,'active-after-revoked',
    'BALE',v_recipient,3);
  UPDATE public.notification_outbox
    SET created_at = t-interval '2 hours'
  WHERE event_key='revoked-oldest';
  UPDATE public.notification_outbox
    SET created_at = t-interval '1 hour'
  WHERE event_key='active-after-revoked';

  SELECT * INTO result FROM public.alert_notification_claim_consented(
    t+interval '6 minutes',30);
  IF result.event_key <> 'active-after-revoked' THEN
    RAISE EXCEPTION 'revoked queue head starved consenting recipient';
  END IF;
  SELECT status INTO current_status FROM public.notification_outbox
  WHERE event_key='revoked-oldest';
  IF current_status <> 'UNKNOWN' THEN
    RAISE EXCEPTION 'revoked queued message not terminated during scan';
  END IF;
  PERFORM public.notification_outbox_finish(result.outbox_id,result.claim_token,
    'UNKNOWN',NULL,t+interval '6 minutes 5 seconds');

  -- Consent can be revoked after a valid claim but BEFORE egress.
  -- A second independent DB check must fail even if the lease is current.
  PERFORM public.notification_outbox_enqueue(v_other,'egress-after-revocation',
    'BALE',v_recipient,3);
  SELECT * INTO result FROM public.alert_notification_claim_consented(
    t+interval '7 minutes',30);
  IF result.event_key <> 'egress-after-revocation' THEN
    RAISE EXCEPTION 'unexpected queue item in revocation preflight';
  END IF;

  UPDATE public.alert_notification_consents
    SET revoked_at = t + interval '7 minutes 1 second'
  WHERE user_id=v_other AND recipient_ref=v_recipient AND channel='BALE';

  IF public.alert_notification_egress_allowed(
      result.outbox_id, result.claim_token, v_recipient,'BALE', t+interval '7 minutes 2 seconds') THEN
    RAISE EXCEPTION 'revoked consent still authorized outbound message';
  END IF;
  IF public.alert_notification_begin_egress(
      result.outbox_id, result.claim_token, v_recipient,'BALE', t+interval '7 minutes 2 seconds') THEN
    RAISE EXCEPTION 'revoked consent issued an outbound send permit';
  END IF;
  IF public.alert_notification_egress_allowed(
      result.outbox_id, gen_random_uuid(), v_recipient,'BALE', t+interval '7 minutes 2 seconds') THEN
    RAISE EXCEPTION 'foreign claim permitted outbound message';
  END IF;
  PERFORM public.notification_outbox_finish(result.outbox_id,result.claim_token,
    'UNKNOWN',NULL,t+interval '7 minutes 3 seconds');

  -- A revoked recipient never qualifies, even when the rule is valid.
  UPDATE public.alert_notification_consents
    SET revoked_at = t-interval '1 minute'
  WHERE user_id=v_other AND recipient_ref=v_recipient AND channel='BALE';

  BEGIN
    PERFORM * FROM public.alert_rule_commit(v_other,'threshold1',0,
      crossed_state,event_id,'BALE',v_recipient,t+interval '1 minute');
    RAISE EXCEPTION 'revoked consent accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- External event keys must match state, trigger and source timestamp.
  BEGIN
    PERFORM * FROM public.alert_rule_commit(v_other,'threshold1',0,
      crossed_state,'wrong-event-id','BALE',v_recipient,t+interval '1 minute');
    RAISE EXCEPTION 'mismatched event identity was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  -- Illegal direct jump into a NOTIFIED state is disallowed.
  BEGIN
    PERFORM * FROM public.alert_rule_commit(v_other,'threshold1',0,
      jsonb_build_object('alert',jsonb_build_object('id','threshold1','phase','NOTIFIED')),
      NULL,NULL,NULL,t+interval '1 minute');
    RAISE EXCEPTION 'unverified NOTIFIED state accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  -- Public ACLs on both new tables/functions must be absent.
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee='PUBLIC' AND table_name IN
      ('alert_rule_runtime','alert_notification_consents')
  ) THEN
    RAISE EXCEPTION 'unsafe PUBLIC table grant';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS p
    JOIN pg_catalog.pg_namespace AS ns ON ns.oid = p.pronamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))
    ) AS acl
    WHERE ns.nspname='public' AND p.proname IN
      ('alert_rule_commit','alert_notification_claim_consented',
       'alert_notification_egress_allowed','alert_notification_begin_egress')
      AND acl.grantee=0 AND acl.privilege_type='EXECUTE'
  ) THEN
    RAISE EXCEPTION 'unsafe PUBLIC execute grant';
  END IF;
END $$;

ROLLBACK;
