-- Kalshi game-winner prices, captured alongside the Odds API consensus so the two
-- can be compared at the same moment (research: is Kalshi off the books?).
-- One row per Kalshi market (= one team's "wins" contract) per capture.
-- event_id links to multisport_fixtures when the game could be matched; NULL otherwise.
-- Prices are dollars per $1 contract (0.00-1.00).
CREATE TABLE IF NOT EXISTS multisport_kalshi_snapshots (
    id               BIGSERIAL PRIMARY KEY,
    sport_key        VARCHAR(64)  NOT NULL,
    event_id         VARCHAR(100),
    kalshi_ticker    VARCHAR(100) NOT NULL,
    kalshi_event     VARCHAR(100) NOT NULL,
    team             VARCHAR(120),
    is_home          BOOLEAN,
    yes_bid          NUMERIC(6,4),
    yes_ask          NUMERIC(6,4),
    last_price       NUMERIC(6,4),
    volume           NUMERIC(16,2),
    volume_24h       NUMERIC(16,2),
    open_interest    NUMERIC(16,2),
    market_status    VARCHAR(32),
    occurrence_time  TIMESTAMPTZ,
    ts_recorded      TIMESTAMPTZ  NOT NULL,
    UNIQUE (kalshi_ticker, ts_recorded)
);
CREATE INDEX IF NOT EXISTS ix_mskalshi_event_ts  ON multisport_kalshi_snapshots (event_id, ts_recorded);
CREATE INDEX IF NOT EXISTS ix_mskalshi_sport_ts  ON multisport_kalshi_snapshots (sport_key, ts_recorded);
