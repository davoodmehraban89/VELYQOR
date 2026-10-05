BEGIN;

CREATE TYPE asset_class AS ENUM ('FX','COMMODITY','DERIVED','CRYPTO','EQUITY','OTHER');
CREATE TYPE quality_state AS ENUM ('GOOD','DEGRADED','STALE','INVALID');

CREATE TABLE instruments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  asset_class asset_class NOT NULL,
  base_asset TEXT NOT NULL,
  quote_asset TEXT NOT NULL,
  unit TEXT NOT NULL,
  market TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  price_precision SMALLINT NOT NULL CHECK (price_precision BETWEEN 0 AND 18),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE providers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  priority SMALLINT NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE provider_instruments (
  provider_id BIGINT NOT NULL REFERENCES providers(id),
  instrument_id BIGINT NOT NULL REFERENCES instruments(id),
  external_symbol TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (provider_id, instrument_id),
  UNIQUE (provider_id, external_symbol)
);

CREATE TABLE raw_market_observations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider_id BIGINT NOT NULL REFERENCES providers(id),
  instrument_id BIGINT NOT NULL REFERENCES instruments(id),
  provider_timestamp TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_price TEXT NOT NULL,
  raw_payload JSONB,
  raw_payload_hash TEXT,
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  CHECK (length(raw_price) > 0)
);
CREATE INDEX raw_observations_lookup_idx ON raw_market_observations (instrument_id, provider_timestamp DESC);
CREATE INDEX raw_observations_received_idx ON raw_market_observations (received_at DESC);

CREATE TABLE market_ticks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instrument_id BIGINT NOT NULL REFERENCES instruments(id),
  provider_id BIGINT NOT NULL REFERENCES providers(id),
  ts TIMESTAMPTZ NOT NULL,
  price NUMERIC(30,10) NOT NULL CHECK (price > 0),
  quality quality_state NOT NULL,
  quality_score NUMERIC(5,2) NOT NULL CHECK (quality_score BETWEEN 0 AND 100),
  flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_observation_id BIGINT REFERENCES raw_market_observations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX market_ticks_lookup_idx ON market_ticks (instrument_id, ts DESC);

CREATE TABLE candles (
  instrument_id BIGINT NOT NULL REFERENCES instruments(id),
  timeframe TEXT NOT NULL,
  open_time TIMESTAMPTZ NOT NULL,
  close_time TIMESTAMPTZ NOT NULL,
  open NUMERIC(30,10) NOT NULL CHECK (open > 0),
  high NUMERIC(30,10) NOT NULL CHECK (high > 0),
  low NUMERIC(30,10) NOT NULL CHECK (low > 0),
  close NUMERIC(30,10) NOT NULL CHECK (close > 0),
  volume NUMERIC(30,10),
  observation_count INTEGER NOT NULL CHECK (observation_count > 0),
  quality quality_state NOT NULL,
  quality_score NUMERIC(5,2) NOT NULL CHECK (quality_score BETWEEN 0 AND 100),
  PRIMARY KEY (instrument_id, timeframe, open_time),
  CHECK (open_time < close_time),
  CHECK (low <= open AND open <= high),
  CHECK (low <= close AND close <= high),
  CHECK (low <= high)
);

CREATE TABLE derived_market_values (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instrument_id BIGINT NOT NULL REFERENCES instruments(id),
  ts TIMESTAMPTZ NOT NULL,
  value NUMERIC(30,10) NOT NULL,
  calculation_version TEXT NOT NULL,
  source_snapshot JSONB NOT NULL,
  quality quality_state NOT NULL,
  quality_score NUMERIC(5,2) NOT NULL CHECK (quality_score BETWEEN 0 AND 100),
  flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (instrument_id, ts, calculation_version)
);
CREATE INDEX derived_values_lookup_idx ON derived_market_values (instrument_id, ts DESC);

CREATE TABLE data_quality_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instrument_id BIGINT REFERENCES instruments(id),
  provider_id BIGINT REFERENCES providers(id),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('INFO','WARNING','ERROR','CRITICAL')),
  started_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  CHECK (resolved_at IS NULL OR resolved_at >= started_at)
);

INSERT INTO instruments(symbol, display_name, asset_class, base_asset, quote_asset, unit, market, timezone, price_precision) VALUES
('USD_IRT_FREE','US Dollar / Iranian Toman — Free Market','FX','USD','IRT','IRT_PER_USD','IRAN_FREE','Asia/Tehran',0),
('GOLD18_IRT','18K Gold / Iranian Toman','COMMODITY','GOLD18_GRAM','IRT','IRT_PER_GRAM','IRAN','Asia/Tehran',0),
('XAU_USD','Gold Spot / US Dollar','COMMODITY','XAU','USD','USD_PER_TROY_OUNCE','GLOBAL','UTC',4),
('GOLD18_THEORETICAL_IRT','Theoretical 18K Gold / Iranian Toman','DERIVED','GOLD18_GRAM','IRT','IRT_PER_GRAM','VELYQOR','Asia/Tehran',0),
('GOLD18_PREMIUM_IRT','18K Gold Premium / Iranian Toman','DERIVED','GOLD18_PREMIUM','IRT','IRT_PER_GRAM','VELYQOR','Asia/Tehran',0),
('GOLD18_PREMIUM_PCT','18K Gold Premium Percent','DERIVED','GOLD18_PREMIUM','PCT','PERCENT','VELYQOR','Asia/Tehran',4);

COMMIT;
