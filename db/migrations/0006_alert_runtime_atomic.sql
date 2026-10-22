BEGIN;

-- ChartNova advisory-only evaluation state, versioned CAS and consent-guarded
-- outbox creation. Depends on unmerged PR #34 / migration 0004. Migration 0005
-- is intentionally NOT included, applied or modified.
-- DO NOT deploy to Neon production without separate explicit authorization.

CREATE TABLE public.alert_rule_runtime (
  user_id UUID NOT NULL REFERENCES public.app_users(id),
  rule_key TEXT NOT NULL CHECK (length(trim(rule_key)) BETWEEN 1 AND 96),
  revision BIGINT NOT NULL DEFAULT 0 CHECK (revision >= 0),
  state JSONB NOT NULL DEFAULT '{"alert":{"phase":"ARMED"}}'::jsonb
    CHECK (jsonb_typeof(state) = 'object' AND length(state::text) <= 8192),
  last_event_key TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, rule_key),
  CONSTRAINT alert_runtime_event_key_consistency CHECK (
    (last_event_key IS NULL) OR length(last_event_key) BETWEEN 1 AND 128
  )
);

CREATE TABLE public.alert_notification_consents (
  user_id UUID NOT NULL REFERENCES public.app_users(id),
  recipient_ref UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('BALE','EITA','PWA')),
  consented_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, recipient_ref, channel),
  CHECK (revoked_at IS NULL OR revoked_at >= consented_at)
);

CREATE INDEX alert_notification_active_consents_idx
 ON public.alert_notification_consents (user_id, recipient_ref, channel)
 WHERE revoked_at IS NULL;

-- Optimistic concurrency at the PostgreSQL row lock. The domain engine
-- independently evaluates only quality-approved, entitled observations;
-- this function ensures an event and its state are committed atomically.
--
-- No broker, external HTTP, live data, secret or notification is involved.
-- Enqueued messages remain unsent until an independently approved sender exists.
CREATE FUNCTION public.alert_rule_commit(
  p_user_id UUID,
  p_rule_key TEXT,
  p_expected_revision BIGINT,
  p_next_state JSONB,
  p_event_key TEXT DEFAULT NULL,
  p_channel TEXT DEFAULT NULL,
  p_recipient_ref UUID DEFAULT NULL,
  p_at TIMESTAMPTZ DEFAULT now()
) RETURNS TABLE (
  outcome TEXT,
  new_revision BIGINT,
  outbox_id UUID
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_current public.alert_rule_runtime%ROWTYPE;
  v_old_phase TEXT;
  v_new_phase TEXT;
  v_old_timestamp TIMESTAMPTZ;
  v_new_timestamp TIMESTAMPTZ;
  v_outbox UUID := NULL;
BEGIN
  IF p_user_id IS NULL OR p_rule_key IS NULL
    OR length(trim(p_rule_key)) NOT BETWEEN 1 AND 96
    OR p_expected_revision IS NULL OR p_expected_revision < 0
    OR p_next_state IS NULL OR jsonb_typeof(p_next_state) <> 'object'
    OR length(p_next_state::text) > 8192
    OR p_at IS NULL
  THEN RAISE EXCEPTION 'invalid alert revision request' USING ERRCODE = '22023';
  END IF;

  v_new_phase := p_next_state #>> '{alert,phase}';
  IF v_new_phase NOT IN ('ARMED','TRIGGERED') OR v_new_phase IS NULL
    OR p_next_state #>> '{alert,id}' IS DISTINCT FROM p_rule_key
  THEN RAISE EXCEPTION 'invalid alert state or identity' USING ERRCODE = '22023';
  END IF;

  -- First writer creates a lockable baseline. All subsequent writers lock it.
  -- The initial state is ARMED revision 0 and has no pending notification.
  INSERT INTO public.alert_rule_runtime(user_id, rule_key, state)
   VALUES (p_user_id, p_rule_key,
     jsonb_build_object('alert',jsonb_build_object('phase','ARMED','id',p_rule_key)))
   ON CONFLICT (user_id, rule_key) DO NOTHING;

  SELECT * INTO v_current FROM public.alert_rule_runtime AS r
   WHERE r.user_id = p_user_id AND r.rule_key = p_rule_key
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'missing locked alert row' USING ERRCODE = '40001';
  END IF;

  IF v_current.revision <> p_expected_revision THEN
    outcome := 'STALE_REVISION';
    new_revision := v_current.revision;
    outbox_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  v_old_phase := v_current.state #>> '{alert,phase}';
  IF v_old_phase <> 'ARMED' THEN
    outcome := 'ALREADY_TERMINAL';
    new_revision := v_current.revision;
    outbox_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_next_state #>> '{alert,lastTimestamp}' IS NOT NULL THEN
    BEGIN
      v_new_timestamp := (p_next_state #>> '{alert,lastTimestamp}')::timestamptz;
      IF v_current.state #>> '{alert,lastTimestamp}' IS NOT NULL THEN
        v_old_timestamp := (v_current.state #>> '{alert,lastTimestamp}')::timestamptz;
      END IF;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'invalid sample timestamp in alert state'
        USING ERRCODE = '22023';
    END;
    IF (v_old_timestamp IS NOT NULL AND v_new_timestamp < v_old_timestamp)
       OR v_new_timestamp > p_at + interval '30 seconds' THEN
      RAISE EXCEPTION 'out of sequence alert state' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_new_phase = 'TRIGGERED' THEN
    IF p_event_key IS NULL OR length(p_event_key) NOT BETWEEN 1 AND 128
      OR p_next_state #>> '{alert,eventId}' IS DISTINCT FROM p_event_key
      OR p_next_state #>> '{alert,triggeredAt}' IS NULL
      OR p_next_state #>> '{alert,lastTimestamp}' IS NULL
      OR p_next_state #>> '{alert,triggeredAt}'
         IS DISTINCT FROM p_next_state #>> '{alert,lastTimestamp}'
      OR p_recipient_ref IS NULL OR p_channel NOT IN ('BALE','EITA','PWA')
      OR p_channel IS NULL
      OR (v_old_timestamp IS NOT NULL AND v_new_timestamp <= v_old_timestamp)
    THEN RAISE EXCEPTION 'invalid triggered event or recipient' USING ERRCODE = '22023';
    END IF;

    -- Defense in depth: the data-integrity gate must have accepted the
    -- same exact timestamp; an event cannot bypass a suspended price feed.
    IF p_next_state #>> '{gate,suspended}' IS DISTINCT FROM 'false'
      OR p_next_state #>> '{gate,lastSampleAt}'
        IS DISTINCT FROM p_next_state #>> '{alert,lastTimestamp}'
      OR p_next_state #>> '{gate,lastAccepted,timestamp}'
        IS DISTINCT FROM p_next_state #>> '{alert,lastTimestamp}'
    THEN
      RAISE EXCEPTION 'unverified or stale quality gate cannot enqueue'
        USING ERRCODE = '22023';
    END IF;

    -- No implicit consent, no stored chat identifiers. Lock the opt-in row so
    -- revocation and enqueue cannot commit in the opposite order.
    PERFORM 1 FROM public.alert_notification_consents AS consent
    WHERE consent.user_id = p_user_id
      AND consent.recipient_ref = p_recipient_ref
      AND consent.channel = p_channel
      AND consent.consented_at <= p_at
      AND consent.revoked_at IS NULL
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'notification recipient consent not verified'
        USING ERRCODE = '42501';
    END IF;

    v_outbox := public.notification_outbox_enqueue(
      p_user_id, p_event_key, p_channel, p_recipient_ref, 3
    );
  ELSE
    IF p_event_key IS NOT NULL OR p_channel IS NOT NULL
       OR p_recipient_ref IS NOT NULL
    THEN RAISE EXCEPTION 'ARMED state cannot enqueue event' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.alert_rule_runtime AS r
   SET revision = r.revision + 1,
       state = p_next_state,
       last_event_key = CASE WHEN v_new_phase = 'TRIGGERED'
         THEN p_event_key ELSE r.last_event_key END,
       updated_at = p_at
   WHERE r.user_id = p_user_id AND r.rule_key = p_rule_key
   RETURNING r.revision INTO new_revision;

  outcome := CASE WHEN v_new_phase = 'TRIGGERED'
    THEN 'TRIGGERED_ENQUEUED' ELSE 'STATE_SAVED' END;
  outbox_id := v_outbox;
  RETURN NEXT;
END;
$$;

-- Optional future sender MUST claim through this consent-aware wrapper,
-- not through the raw generic outbox claimant. A revoked consent permanently
-- suppresses pending notification and never leaks it to a transport worker.
-- The later live sender will require a second check just before HTTP send.
CREATE FUNCTION public.alert_notification_claim_consented(
  p_now TIMESTAMPTZ DEFAULT now(),
  p_lease_seconds INTEGER DEFAULT 30
) RETURNS TABLE (
  outbox_id UUID,
  event_key TEXT,
  channel TEXT,
  recipient_ref UUID,
  claim_token UUID,
  attempt_number INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $alert_claim$
DECLARE
  v_claim RECORD;
  v_authorized BOOLEAN;
  v_scan INTEGER;
BEGIN
  IF p_now IS NULL OR p_lease_seconds IS NULL
    OR p_lease_seconds NOT BETWEEN 1 AND 300 THEN
    RAISE EXCEPTION 'invalid consent-aware claim parameters'
      USING ERRCODE = '22023';
  END IF;

  -- Skip a bounded revoked-recipient backlog within the same claim,
  -- otherwise a revoked queue head could starve valid users.
  FOR v_scan IN 1..16 LOOP
  v_authorized := false;
  SELECT * INTO v_claim
    FROM public.notification_outbox_claim(p_now, p_lease_seconds);
  IF NOT FOUND THEN RETURN; END IF;

  -- Check actual persisted user and recipient/owner binding rather than
  -- trusting the caller or relying solely on opt-in at enqueue time.
  SELECT true INTO v_authorized
  FROM public.notification_outbox AS o
  JOIN public.alert_notification_consents AS consent
    ON consent.user_id = o.user_id
     AND consent.recipient_ref = o.recipient_ref
     AND consent.channel = o.channel
  WHERE o.id = v_claim.outbox_id
    AND o.status = 'LEASED'
    AND o.lease_token = v_claim.claim_token
    AND consent.consented_at <= p_now
    AND consent.revoked_at IS NULL
  FOR SHARE OF consent;

  IF NOT COALESCE(v_authorized,false) THEN
    -- No network call is performed. UNKNOWN is terminal under PR #34 schema;
    -- the explicit reason distinguishes revoked consent from uncertain send.
    UPDATE public.notification_outbox AS o
    SET status = 'UNKNOWN',
        failure_reason = 'RECIPIENT_CONSENT_REVOKED_OR_MISSING',
        lease_token = NULL,
        leased_at = NULL,
        lease_until = NULL,
        next_retry_at = NULL,
        updated_at = p_now
    WHERE o.id = v_claim.outbox_id
      AND o.status = 'LEASED'
      AND o.lease_token = v_claim.claim_token;
    CONTINUE;
  END IF;

  outbox_id := v_claim.outbox_id;
  event_key := v_claim.event_key;
  channel := v_claim.channel;
  recipient_ref := v_claim.recipient_ref;
  claim_token := v_claim.claim_token;
  attempt_number := v_claim.attempt_number;
  RETURN NEXT;
  RETURN;
  END LOOP;
  RETURN;
END;
$alert_claim$;

-- A message leased to a sender may be processed by overlapping job retries.
-- Atomically consume a single send permit before ANY external network call.
-- If the sender crashes after this point, lease expiry becomes terminal UNKNOWN
-- under PR #34 (at-most-once attempt, possibly no delivery).
ALTER TABLE public.notification_outbox
 ADD COLUMN send_started_at TIMESTAMPTZ;

CREATE FUNCTION public.alert_notification_begin_egress(
  p_outbox_id UUID,
  p_claim_token UUID,
  p_recipient_ref UUID,
  p_channel TEXT,
  p_at TIMESTAMPTZ DEFAULT now()
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $egress_begin$
DECLARE
  v_id UUID;
BEGIN
  IF p_outbox_id IS NULL OR p_claim_token IS NULL OR p_recipient_ref IS NULL
    OR p_channel IS NULL OR p_channel NOT IN ('BALE','EITA','PWA')
    OR p_at IS NULL THEN
    RAISE EXCEPTION 'invalid one-send authorization parameters'
      USING ERRCODE = '22023';
  END IF;

  -- The UPDATE row-lock is the linearization point for all overlapping
  -- senders using the same lease. WHERE send_started_at IS NULL ensures a
  -- repeat caller receives FALSE without attempting a duplicate message.
  UPDATE public.notification_outbox AS o
  SET send_started_at = p_at, updated_at = p_at
  FROM public.alert_notification_consents AS c
  WHERE o.id = p_outbox_id
    AND o.lease_token = p_claim_token
    AND o.recipient_ref = p_recipient_ref
    AND o.channel = p_channel
    AND o.status = 'LEASED'
    AND o.send_started_at IS NULL
    AND o.leased_at <= p_at AND o.lease_until > p_at
    AND c.user_id = o.user_id
    AND c.channel = o.channel
    AND c.recipient_ref = o.recipient_ref
    AND c.consented_at <= p_at
    AND c.revoked_at IS NULL
  RETURNING o.id INTO v_id;

  RETURN v_id IS NOT NULL;
END;
$egress_begin$;

-- Second consent checkpoint immediately before a sender attempts HTTPS.
-- A claim-time check alone is insufficient: the user can revoke consent later.
-- This function is side-effect-free on a valid row, returns ONLY a boolean,
-- and never reads or reveals a chat ID, token or message payload.
CREATE FUNCTION public.alert_notification_egress_allowed(
  p_outbox_id UUID,
  p_claim_token UUID,
  p_recipient_ref UUID,
  p_channel TEXT,
  p_at TIMESTAMPTZ DEFAULT now()
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $egress_check$
DECLARE
  v_can_send BOOLEAN := FALSE;
BEGIN
  IF p_outbox_id IS NULL OR p_claim_token IS NULL OR p_recipient_ref IS NULL
    OR p_channel IS NULL OR p_channel NOT IN ('BALE','EITA','PWA')
    OR p_at IS NULL THEN
    RAISE EXCEPTION 'invalid outbound authorization parameters'
      USING ERRCODE = '22023';
  END IF;

  -- Keep the outbox row locked during the check. The caller must use a
  -- trusted backend role; no frontend, browser or PUBLIC access is granted.
  SELECT true INTO v_can_send
  FROM public.notification_outbox AS o
  JOIN public.alert_notification_consents AS c
    ON c.user_id = o.user_id
    AND c.recipient_ref = o.recipient_ref
    AND c.channel = o.channel
  WHERE o.id = p_outbox_id AND o.lease_token = p_claim_token
    AND o.recipient_ref = p_recipient_ref AND o.channel = p_channel
    AND o.status = 'LEASED'
    AND o.leased_at <= p_at AND o.lease_until > p_at
    AND c.consented_at <= p_at AND c.revoked_at IS NULL
  FOR SHARE OF c;

  RETURN COALESCE(v_can_send, FALSE);
END;
$egress_check$;

-- Persisted state is owned by backend service only. No default browser/anon
-- SELECT/INSERT/UPDATE or function EXECUTE grants are introduced.
REVOKE ALL ON public.alert_rule_runtime FROM PUBLIC;
REVOKE ALL ON public.alert_notification_consents FROM PUBLIC;
REVOKE ALL ON FUNCTION public.alert_rule_commit(
  UUID, TEXT, BIGINT, JSONB, TEXT, TEXT, UUID, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.alert_notification_claim_consented(
  TIMESTAMPTZ, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.alert_notification_egress_allowed(
  UUID, UUID, UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.alert_notification_begin_egress(
  UUID, UUID, UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;

COMMIT;
