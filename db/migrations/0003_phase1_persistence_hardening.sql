BEGIN;

-- Phase 1 persistence hardening: idempotency, provenance and query integrity.

ALTER TABLE raw_market_observations
  ADD CONSTRAINT raw_provider_time_before_receive
  CHECK (provider_timestamp IS NULL OR provider_timestamp <= received_at);

CREATE UNIQUE INDEX raw_observations_provider_hash_uidx
  ON raw_market_observations(provider_id, instrument_id, raw_payload_hash)
  WHERE raw_payload_hash IS NOT NULL;

CREATE UNIQUE INDEX market_ticks_provider_time_uidx
  ON market_ticks(instrument_id, provider_id, ts);

ALTER TABLE market_ticks
  ADD CONSTRAINT market_ticks_raw_observation_unique UNIQUE (raw_observation_id);

CREATE INDEX candles_lookup_idx
  ON candles(instrument_id, timeframe, open_time DESC);

CREATE INDEX quality_events_open_idx
  ON data_quality_events(provider_id, instrument_id, started_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE data_quality_events
  ADD CONSTRAINT quality_event_type_nonempty CHECK (length(trim(event_type)) > 0);

COMMIT;
