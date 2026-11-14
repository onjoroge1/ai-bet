-- AI researcher forecasts (paper only). One row per game per model, written ~1-2.5h before
-- start, with the market's price at that moment so the forecast can be scored later.
CREATE TABLE IF NOT EXISTS multisport_ai_forecasts (
    id                 BIGSERIAL PRIMARY KEY,
    sport_key          VARCHAR(64)  NOT NULL,
    event_id           VARCHAR(100) NOT NULL,
    commence_time      TIMESTAMPTZ  NOT NULL,
    home_team          VARCHAR(120) NOT NULL,
    away_team          VARCHAR(120) NOT NULL,
    model              VARCHAR(64)  NOT NULL,
    prob_home          NUMERIC(6,4) NOT NULL,          -- AI's home win probability
    confidence         VARCHAR(8),                     -- low | medium | high
    key_factors        JSONB,                          -- [{factor, favours, weight}]
    news_found         TEXT,                           -- late news the search turned up
    reasoning          TEXT,
    market_prob_home   NUMERIC(6,4),                   -- de-vigged book consensus at forecast time
    kalshi_prob_home   NUMERIC(6,4),
    brief              JSONB,                          -- exactly what the model was given
    web_searches       INTEGER,
    input_tokens       INTEGER,
    output_tokens      INTEGER,
    cost_usd_est       NUMERIC(8,4),
    ts_recorded        TIMESTAMPTZ  NOT NULL,
    UNIQUE (event_id, model)
);
CREATE INDEX IF NOT EXISTS ix_msai_time ON multisport_ai_forecasts (sport_key, commence_time);
