-- NHL regulation-time (3-way: home / draw / away after 60 minutes) moneyline, from The Odds API
-- `h2h_3_way` event-odds market. One pull per game shortly before puck drop (1 credit a game).
CREATE TABLE IF NOT EXISTS multisport_regulation_odds (
    id            BIGSERIAL PRIMARY KEY,
    sport_key     VARCHAR(64)  NOT NULL,
    event_id      VARCHAR(100) NOT NULL,
    commence_time TIMESTAMPTZ  NOT NULL,
    home_team     VARCHAR(120) NOT NULL,
    away_team     VARCHAR(120) NOT NULL,
    bookmaker     VARCHAR(64)  NOT NULL,          -- 'consensus' or a book key
    is_consensus  BOOLEAN      NOT NULL DEFAULT FALSE,
    home_odds     NUMERIC(8,3),
    draw_odds     NUMERIC(8,3),
    away_odds     NUMERIC(8,3),
    home_prob     NUMERIC(6,4),                   -- de-vigged
    draw_prob     NUMERIC(6,4),
    away_prob     NUMERIC(6,4),
    overround     NUMERIC(6,4),
    n_bookmakers  INTEGER,
    ts_recorded   TIMESTAMPTZ  NOT NULL,
    UNIQUE (event_id, bookmaker, ts_recorded)
);
CREATE INDEX IF NOT EXISTS ix_msro_event ON multisport_regulation_odds (event_id);
CREATE INDEX IF NOT EXISTS ix_msro_sport_commence ON multisport_regulation_odds (sport_key, commence_time);
