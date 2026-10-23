-- Disposable GitHub Actions DB ONLY. This regression verifies that the
-- migration's documented default-deny PostgreSQL ACL boundary is real.
-- The test role and all test actions are rolled back before completion.
BEGIN;

DO $$
BEGIN
  IF current_database() <> 'velyqor_test' THEN
    RAISE EXCEPTION 'REFUSE_NON_EPHEMERAL_DATABASE';
  END IF;
END $$;

CREATE ROLE chartnova_untrusted_probe NOLOGIN;
SET LOCAL ROLE chartnova_untrusted_probe;

DO $$
DECLARE
  function_signature TEXT;
  table_name TEXT;
  row_count INTEGER;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'notification_outbox',
    'alert_rule_runtime',
    'alert_notification_consents'
  ] LOOP
    IF has_table_privilege(current_user,
       'public.' || table_name, 'SELECT')
       OR has_table_privilege(current_user,
          'public.' || table_name, 'INSERT')
       OR has_table_privilege(current_user,
          'public.' || table_name, 'UPDATE') THEN
      RAISE EXCEPTION 'Untrusted role has table privileges: %', table_name;
    END IF;
    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I',table_name)
        INTO row_count;
      RAISE EXCEPTION 'Untrusted role read protected table: %',table_name;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
  END LOOP;

  FOREACH function_signature IN ARRAY ARRAY[
    'public.notification_outbox_enqueue(uuid,text,text,uuid,integer)',
    'public.notification_outbox_claim(timestamptz,integer)',
    'public.notification_outbox_finish(uuid,uuid,text,text,timestamptz,integer)',
    'public.notification_outbox_acknowledge(uuid,uuid,timestamptz)',
    'public.alert_rule_commit(uuid,text,bigint,jsonb,text,text,uuid,timestamptz)',
    'public.alert_notification_claim_consented(timestamptz,integer)',
    'public.alert_notification_begin_egress(uuid,uuid,uuid,text,timestamptz)',
    'public.alert_notification_egress_allowed(uuid,uuid,uuid,text,timestamptz)'
  ] LOOP
    IF has_function_privilege(current_user,
       function_signature,'EXECUTE') THEN
      RAISE EXCEPTION 'Untrusted role can execute privileged function: %',
        function_signature;
    END IF;
  END LOOP;

  -- Test the authorization check itself, not just an explicit catalog flag.
  BEGIN
    PERFORM public.alert_notification_claim_consented(now(),30);
    RAISE EXCEPTION 'Untrusted role executed protected claim function';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  RAISE NOTICE 'ALERT_RUNTIME_ROLE_ISOLATION_VERIFIED';
END $$;

ROLLBACK;
