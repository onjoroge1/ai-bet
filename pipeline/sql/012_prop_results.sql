-- Every prop line, graded (research, paper only). One row per game x market x player x line x pull,
-- summarising all books that priced BOTH sides at that line: no-vig over/under probabilities, best
-- price on each side, and the result from the box score. Built from multisport_player_props, so it
-- costs no API credits. NBA is graded from ESPN box scores; NFL rows stay ungraded for now.
CREATE TABLE IF NOT EXISTS multisport_prop_results (
    id               BIGSERIAL PRIMARY KEY,
    sport_key        VARCHAR(64)  NOT NULL,
    event_id         VARCHAR(100) NOT NULL,
    commence_time    TIMESTAMPTZ,
    home_team        VARCHAR(120),
    away_team        VARCHAR(120),
    market           VARCHAR(64)  NOT NULL,
    player_name      VARCHAR(120) NOT NULL,
    line             NUMERIC(8,2) NOT NULL,
    is_main_line     BOOLEAN      NOT NULL,       -- line = median line across books for this player/market/pull
    n_books          INTEGER      NOT NULL,       -- books with both sides priced at this line
    over_prob        NUMERIC(6,4) NOT NULL,       -- mean no-vig probability of the over
    under_prob       NUMERIC(6,4) NOT NULL,       -- 1 - over_prob
    avg_overround    NUMERIC(6,4),
    best_over        NUMERIC(8,3),
    best_over_book   VARCHAR(64),
    best_under       NUMERIC(8,3),
    best_under_book  VARCHAR(64),
    ts_recorded      TIMESTAMPTZ  NOT NULL,       -- the pull these prices come from
    actual           NUMERIC(8,2),                -- player's stat from the box score
    result           VARCHAR(5),                  -- over | under | push | void (did not play); NULL = ungraded
    graded_at        TIMESTAMPTZ,
    UNIQUE (event_id, market, player_name, line, ts_recorded)
);
CREATE INDEX IF NOT EXISTS ix_mspr_sport_time ON multisport_prop_results (sport_key, commence_time);
CREATE INDEX IF NOT EXISTS ix_mspr_ungraded ON multisport_prop_results (commence_time) WHERE graded_at IS NULL;
