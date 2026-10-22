BEGIN;

-- ChartNova informational-alert outbox. SCHEMA ONLY: applying this file does
-- not create an alert, contact a user, contact a broker or enable a Worker.
-- Do not apply to live Neon without separate authorization.
-- This outbox stores opaque recipient references, NOT chat IDs or bot tokens.
-- Producer must ensure provider display/derived-alert rights before enqueueing.

CREATE TABLE notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id),
  event_key TEXT NOT NULL CHECK (length(trim(event_key)) BETWEEN 1 AND 128),
  channel TEXT NOT NULL CHECK (channel IN ('BALE','EITA','PWA')),
  recipient_ref UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','LEASED','FAILED','UNKNOWN','SENT','ACKNOWLEDGED')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  lease_token UUID,
  leased_at TIMESTAMPTZ,
  lease_until TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  provider_message_id TEXT,
  provider_accepted_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_outbox_event_once
    UNIQUE (user_id, event_key, channel, recipient_ref),
  CONSTRAINT notification_outbox_attempt_limit CHECK (attempts <= max_attempts),
  CONSTRAINT notification_outbox_lease_consistency CHECK (
    (status = 'LEASED') =
      (lease_token IS NOT NULL AND leased_at IS NOT NULL AND lease_until IS NOT NULL)
  ),
  CONSTRAINT notification_outbox_lease_time CHECK (
    lease_until IS NULL OR leased_at IS NOT NULL AND lease_until > leased_at
  ),
  CONSTRAINT notification_outbox_receipt_consistency CHECK (
    status NOT IN ('SENT','ACKNOWLEDGED') OR
    (provider_message_id IS NOT NULL AND length(trim(provider_message_id)) > 0
      AND provider_accepted_at IS NOT NULL)
  ),
  CONSTRAINT notification_outbox_ack_consistency CHECK (
    (status = 'ACKNOWLEDGED') = (acknowledged_at IS NOT NULL)
  ),
  CONSTRAINT notification_outbox_ack_chronology CHECK (
    acknowledged_at IS NULL OR
    provider_accepted_at IS NOT NULL AND acknowledged_at >= provider_accepted_at
  )
);

CREATE INDEX notification_outbox_ready_idx
 ON notification_outbox (next_retry_at, created_at, id)
 WHERE status IN ('PENDING','FAILED');

CREATE INDEX notification_outbox_expired_idx
 ON notification_outbox (lease_until, id)
 WHERE status = 'LEASED';

CREATE INDEX notification_outbox_user_history_idx
 ON notification_outbox (user_id, created_at DESC);

-- Idempotent enqueue. A duplicate logical event cannot create another send,
-- including when submitted concurrently from independent Workers.
CREATE FUNCTION notification_outbox_enqueue(
  p_user_id UUID,
  p_event_key TEXT,
  p_channel TEXT,
  p_recipient_ref UUID,
  p_max_attempts INTEGER DEFAULT 3
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE v_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_recipient_ref IS NULL OR p_event_key IS NULL
    OR length(trim(p_event_key)) NOT BETWEEN 1 AND 128
    OR p_channel NOT IN ('BALE','EITA','PWA') OR p_channel IS NULL
    OR p_max_attempts NOT BETWEEN 1 AND 10 OR p_max_attempts IS NULL
  THEN
    RAISE EXCEPTION 'invalid non-secret outbox metadata' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.notification_outbox
    (user_id, event_key, channel, recipient_ref, max_attempts)
  VALUES (p_user_id, p_event_key, p_channel, p_recipient_ref, p_max_attempts)
  ON CONFLICT (user_id, event_key, channel, recipient_ref) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT o.id INTO v_id FROM public.notification_outbox AS o
    WHERE o.user_id = p_user_id AND o.event_key = p_event_key
      AND o.channel = p_channel AND o.recipient_ref = p_recipient_ref;
  END IF;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'could not resolve concurrent outbox enqueue'
      USING ERRCODE = '40001';
  END IF;
  RETURN v_id;
END;
$$;

-- One atomic claim: SELECT FOR UPDATE SKIP LOCKED + UPDATE in one statement.
-- Claim MAY return zero rows. Expired in-flight leases are UNKNOWN, NEVER
-- automatically retried: prior Worker may have sent before crashing.
CREATE FUNCTION notification_outbox_claim(
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
AS $$
BEGIN
  IF p_now IS NULL OR p_lease_seconds NOT BETWEEN 1 AND 300
    OR p_lease_seconds IS NULL
  THEN RAISE EXCEPTION 'invalid lease parameters' USING ERRCODE = '22023';
  END IF;

  UPDATE public.notification_outbox AS expired
  SET status = 'UNKNOWN',
      failure_reason = 'LEASE_EXPIRED_DELIVERY_UNCERTAIN',
      lease_token = NULL,
      leased_at = NULL,
      lease_until = NULL,
      next_retry_at = NULL,
      updated_at = p_now
  WHERE expired.status = 'LEASED' AND expired.lease_until <= p_now;

  RETURN QUERY
  WITH candidate AS (
    SELECT o.id
    FROM public.notification_outbox AS o
    WHERE o.status IN ('PENDING','FAILED')
      AND o.attempts < o.max_attempts
      AND (o.next_retry_at IS NULL OR o.next_retry_at <= p_now)
    ORDER BY o.created_at, o.id
    LIMIT 1 FOR UPDATE OF o SKIP LOCKED
  )
  UPDATE public.notification_outbox AS claimed
  SET status = 'LEASED',
      attempts = claimed.attempts + 1,
      lease_token = gen_random_uuid(),
      leased_at = p_now,
      lease_until = p_now + make_interval(secs => p_lease_seconds),
      next_retry_at = NULL,
      failure_reason = NULL,
      updated_at = p_now
  FROM candidate
  WHERE claimed.id = candidate.id
  RETURNING claimed.id, claimed.event_key, claimed.channel,
    claimed.recipient_ref, claimed.lease_token, claimed.attempts;
END;
$$;

-- A source can only finish the exact lease it claimed. Unknown results are
-- terminal pending manual reconciliation, never "safe to retry".
-- Decision REJECTED is only for a provider-confirmed non-delivery.
CREATE FUNCTION notification_outbox_finish(
  p_outbox_id UUID,
  p_claim_token UUID,
  p_decision TEXT,
  p_provider_message_id TEXT DEFAULT NULL,
  p_at TIMESTAMPTZ DEFAULT now(),
  p_retry_seconds INTEGER DEFAULT 60
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE v_status TEXT;
BEGIN
  IF p_outbox_id IS NULL OR p_claim_token IS NULL
    OR p_decision NOT IN ('SENT','REJECTED','UNKNOWN') OR p_decision IS NULL
    OR p_at IS NULL OR p_retry_seconds NOT BETWEEN 1 AND 86400
    OR p_retry_seconds IS NULL
    OR (p_decision = 'SENT' AND
      (p_provider_message_id IS NULL OR length(trim(p_provider_message_id)) = 0))
    OR (p_decision <> 'SENT' AND p_provider_message_id IS NOT NULL)
  THEN RAISE EXCEPTION 'invalid outbox completion' USING ERRCODE = '22023';
  END IF;

  UPDATE public.notification_outbox AS o
  SET status = CASE
        WHEN p_decision = 'SENT' THEN 'SENT'
        WHEN p_decision = 'UNKNOWN' THEN 'UNKNOWN'
        ELSE 'FAILED'
      END,
      lease_token = NULL,
      leased_at = NULL,
      lease_until = NULL,
      provider_message_id = CASE WHEN p_decision = 'SENT'
        THEN p_provider_message_id ELSE NULL END,
      provider_accepted_at = CASE WHEN p_decision = 'SENT'
        THEN p_at ELSE NULL END,
      failure_reason = CASE
        WHEN p_decision = 'UNKNOWN' THEN 'AMBIGUOUS_PROVIDER_RESPONSE'
        WHEN p_decision = 'REJECTED' AND o.attempts >= o.max_attempts
          THEN 'ATTEMPTS_EXHAUSTED'
        WHEN p_decision = 'REJECTED' THEN 'PROVIDER_CONFIRMED_REJECTION'
        ELSE NULL END,
      next_retry_at = CASE WHEN p_decision = 'REJECTED'
          AND o.attempts < o.max_attempts
        THEN p_at + make_interval(secs => p_retry_seconds)
        ELSE NULL END,
      updated_at = p_at
  WHERE o.id = p_outbox_id AND o.status = 'LEASED'
    AND o.lease_token = p_claim_token
    AND o.leased_at <= p_at AND o.lease_until > p_at
  RETURNING o.status INTO v_status;

  RETURN COALESCE(v_status, 'IGNORED_STALE_OR_INELIGIBLE');
END;
$$;

-- User read/ack requires an external verified identity/consent mechanism.
-- An API success must NEVER be passed to this function as proof of reading.
CREATE FUNCTION notification_outbox_acknowledge(
  p_outbox_id UUID,
  p_user_id UUID,
  p_at TIMESTAMPTZ DEFAULT now()
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE v_id UUID;
BEGIN
  IF p_outbox_id IS NULL OR p_user_id IS NULL OR p_at IS NULL
    THEN RAISE EXCEPTION 'invalid acknowledgement' USING ERRCODE = '22023';
  END IF;
  UPDATE public.notification_outbox AS o
  SET status = 'ACKNOWLEDGED', acknowledged_at = p_at, updated_at = p_at
  WHERE o.id = p_outbox_id AND o.user_id = p_user_id
    AND o.status = 'SENT' AND o.provider_accepted_at <= p_at
  RETURNING o.id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;

-- Fail closed on unspecified database roles. No anon/public execution grants,
-- no SECURITY DEFINER bypass, and no encrypted/private destination stored here.
REVOKE ALL ON TABLE public.notification_outbox FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notification_outbox_enqueue(
  UUID, TEXT, TEXT, UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notification_outbox_claim(
  TIMESTAMPTZ, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notification_outbox_finish(
  UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notification_outbox_acknowledge(
  UUID, UUID, TIMESTAMPTZ) FROM PUBLIC;

COMMIT;
