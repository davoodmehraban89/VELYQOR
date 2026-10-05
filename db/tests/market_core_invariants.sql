BEGIN;

DO $$
DECLARE instrument_count INTEGER;
BEGIN
  SELECT count(*) INTO instrument_count FROM instruments
  WHERE symbol IN ('USD_IRT_FREE','GOLD18_IRT','XAU_USD','GOLD18_THEORETICAL_IRT','GOLD18_PREMIUM_IRT','GOLD18_PREMIUM_PCT');
  IF instrument_count <> 6 THEN
    RAISE EXCEPTION 'Expected 6 canonical MVP instruments, got %', instrument_count;
  END IF;
END $$;

-- Invalid candles must be rejected by constraints.
DO $$
DECLARE usd_id BIGINT;
BEGIN
  SELECT id INTO usd_id FROM instruments WHERE symbol='USD_IRT_FREE';
  BEGIN
    INSERT INTO candles(instrument_id,timeframe,open_time,close_time,open,high,low,close,observation_count,quality,quality_score)
    VALUES(usd_id,'1m','2026-01-01T00:00:00Z','2026-01-01T00:01:00Z',100,90,80,85,2,'GOOD',100);
    RAISE EXCEPTION 'Invalid candle unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END $$;

ROLLBACK;
