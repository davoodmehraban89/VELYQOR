BEGIN;
INSERT INTO providers(code,name,provider_type,priority,active)
VALUES ('ecb_exr','European Central Bank reference exchange rates','CENTRAL_BANK',20,true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO instruments(symbol,display_name,asset_class,base_asset,quote_asset,unit,market,timezone,price_precision)
VALUES
('EUR_USD_ECB','EUR/USD — ECB daily reference rate','FX','EUR','USD','USD_PER_EUR','ECB_REFERENCE','Europe/Frankfurt',4),
('EUR_GBP_ECB','EUR/GBP — ECB daily reference rate','FX','EUR','GBP','GBP_PER_EUR','ECB_REFERENCE','Europe/Frankfurt',4),
('EUR_CHF_ECB','EUR/CHF — ECB daily reference rate','FX','EUR','CHF','CHF_PER_EUR','ECB_REFERENCE','Europe/Frankfurt',4)
ON CONFLICT (symbol) DO NOTHING;

INSERT INTO provider_instruments(provider_id,instrument_id,external_symbol,metadata)
SELECT p.id,i.id,'EXR.D.'||i.quote_asset||'.EUR.SP00.A',
jsonb_build_object('dataset','ECB EXR','frequency','daily','data_kind','reference_observation_not_ohlc','attribution','Source: ECB statistics','source_url','https://data-api.ecb.europa.eu/service/data/EXR/')
FROM instruments i CROSS JOIN providers p
WHERE p.code='ecb_exr' AND i.symbol IN ('EUR_USD_ECB','EUR_GBP_ECB','EUR_CHF_ECB')
ON CONFLICT (provider_id,instrument_id) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS market_ticks_source_observation_uq
ON market_ticks(instrument_id,provider_id,ts);

CREATE OR REPLACE VIEW chartnova_history_public AS
SELECT i.symbol AS symbol,
       i.display_name AS display_name,
       i.quote_asset AS quote_asset,
       p.code AS source,
       t.ts AS observation_at,
       t.price::text AS price,
       t.quality::text AS quality,
       t.flags AS flags
FROM market_ticks t
JOIN instruments i ON i.id=t.instrument_id
JOIN providers p ON p.id=t.provider_id
WHERE p.code='ecb_exr'
  AND i.symbol IN ('EUR_USD_ECB','EUR_GBP_ECB','EUR_CHF_ECB')
  AND t.quality IN ('GOOD','DEGRADED');

COMMENT ON VIEW chartnova_history_public IS
'ECB public daily reference observations (not OHLC candles); source attribution mandatory.';
COMMIT;
