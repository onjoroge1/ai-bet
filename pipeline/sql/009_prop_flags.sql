-- Line-shopping flags (research, paper only): one book's prop price is clearly better than the
-- no-vig average of the OTHER books at the same line. Graded later against box scores.
CREATE TABLE IF NOT EXISTS multisport_prop_flags (
    id            BIGSERIAL PRIMARY KEY,
    sport_key     VARCHAR(64)  NOT NULL,
    event_id      VARCHAR(100) NOT NULL,
    commence_time TIMESTAMPTZ,
    home_team     VARCHAR(120),
    away_team     VARCHAR(120),
    bookmaker     VARCHAR(64)  NOT NULL,
    market        VARCHAR(64)  NOT NULL,
    player_name   VARCHAR(120) NOT NULL,
    line          NUMERIC(8,2) NOT NULL,
    side          VARCHAR(5)   NOT NULL,          -- over | under
    price         NUMERIC(8,3) NOT NULL,          -- decimal odds at the flagged book
    fair_prob     NUMERIC(6,4) NOT NULL,          -- median no-vig probability of this side at the other books
    edge          NUMERIC(7,4) NOT NULL,          -- fair_prob * price - 1
    n_books       INTEGER      NOT NULL,          -- other books behind fair_prob
    ts_recorded   TIMESTAMPTZ  NOT NULL,
    actual        NUMERIC(8,2),                   -- player's stat from the box score
    won           BOOLEAN,                        -- NULL = not graded, push or did not play
    graded_at     TIMESTAMPTZ,
    UNIQUE (event_id, bookmaker, market, player_name, line, side)
);
CREATE INDEX IF NOT EXISTS ix_mspf_time ON multisport_prop_flags (sport_key, commence_time);
