BEGIN;

DO $$
DECLARE
  usd_id BIGINT;
  nav_id BIGINT;
  raw_id BIGINT;
BEGIN
  SELECT id INTO usd_id FROM instruments WHERE symbol = 'USD_IRT_FREE';
  IF usd_id IS NULL THEN RAISE EXCEPTION 'USD_IRT_FREE seed missing'; END IF;

  INSERT INTO providers(code, name, provider_type)
  VALUES ('phase1_test_provider', 'Phase 1 Test Provider', 'TEST')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO nav_id;

  INSERT INTO raw_market_observations(
    provider_id, instrument_id, provider_timestamp, received_at,
    raw_price, raw_payload_hash
  ) VALUES (
    nav_id, usd_id, '2026-10-05T12:00:00Z', '2026-10-05T12:00:01Z',
    '1000000', 'phase1-hash-1'
  ) RETURNING id INTO raw_id;

  INSERT INTO market_ticks(
    instrument_id, provider_id, ts, price, quality, quality_score, raw_observation_id
  ) VALUES (
    usd_id, nav_id, '2026-10-05T12:00:00Z', 100000, 'GOOD', 100, raw_id
  );

  BEGIN
    INSERT INTO market_ticks(
      instrument_id, provider_id, ts, price, quality, quality_score
    ) VALUES (
      usd_id, nav_id, '2026-10-05T12:00:00Z', 100001, 'GOOD', 100
    );
    RAISE EXCEPTION 'duplicate canonical tick unexpectedly accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO raw_market_observations(
      provider_id, instrument_id, provider_timestamp, received_at,
      raw_price, raw_payload_hash
    ) VALUES (
      nav_id, usd_id, '2026-10-05T12:01:02Z', '2026-10-05T12:01:01Z',
      '1000001', 'phase1-hash-future'
    );
    RAISE EXCEPTION 'future provider timestamp unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO candles(
      instrument_id, timeframe, open_time, close_time,
      open, high, low, close, observation_count, quality, quality_score
    ) VALUES (
      usd_id, '1m', '2026-10-05T12:00:00Z', '2026-10-05T12:01:00Z',
      100, 99, 98, 99, 1, 'GOOD', 100
    );
    RAISE EXCEPTION 'invalid OHLC unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END $$;

ROLLBACK;
