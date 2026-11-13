-- Player prop lines (The Odds API event odds) and player box scores (ESPN), for
-- prop research. One prop row per book x market x player x side x line per pull.
CREATE TABLE IF NOT EXISTS multisport_player_props (
    id            BIGSERIAL PRIMARY KEY,
    sport_key     VARCHAR(64)  NOT NULL,
    event_id      VARCHAR(100) NOT NULL,          -- The Odds API event id (= multisport_fixtures.event_id)
    commence_time TIMESTAMPTZ,
    home_team     VARCHAR(120),
    away_team     VARCHAR(120),
    bookmaker     VARCHAR(64)  NOT NULL,
    market        VARCHAR(64)  NOT NULL,          -- player_points | player_rebounds | player_assists | player_threes
    player_name   VARCHAR(120) NOT NULL,
    line          NUMERIC(8,2),
    over_price    NUMERIC(8,3),                   -- decimal odds
    under_price   NUMERIC(8,3),
    book_update   TIMESTAMPTZ,
    ts_recorded   TIMESTAMPTZ  NOT NULL,
    UNIQUE (event_id, bookmaker, market, player_name, line, ts_recorded)
);
CREATE INDEX IF NOT EXISTS ix_msprops_event ON multisport_player_props (event_id, ts_recorded);
CREATE INDEX IF NOT EXISTS ix_msprops_player ON multisport_player_props (sport_key, player_name, commence_time);

-- Long-term summary: one row per game x market x player (prune collapses old per-book rows into it).
CREATE TABLE IF NOT EXISTS multisport_player_prop_consensus (
    id            BIGSERIAL PRIMARY KEY,
    sport_key     VARCHAR(64)  NOT NULL,
    event_id      VARCHAR(100) NOT NULL,
    commence_time TIMESTAMPTZ,
    market        VARCHAR(64)  NOT NULL,
    player_name   VARCHAR(120) NOT NULL,
    line          NUMERIC(8,2),                   -- median line across books
    over_prob     NUMERIC(6,4),                   -- mean no-vig over probability among books at that line
    n_books       INTEGER,
    best_over     NUMERIC(8,3),
    best_under    NUMERIC(8,3),
    ts_recorded   TIMESTAMPTZ  NOT NULL,
    UNIQUE (event_id, market, player_name, ts_recorded)
);
CREATE INDEX IF NOT EXISTS ix_mspropc_player ON multisport_player_prop_consensus (sport_key, player_name, commence_time);

CREATE TABLE IF NOT EXISTS multisport_player_boxscores (
    id             BIGSERIAL PRIMARY KEY,
    sport_key      VARCHAR(64)  NOT NULL,
    espn_event_id  VARCHAR(32)  NOT NULL,
    event_id       VARCHAR(100),                  -- linked multisport_fixtures row, when found
    game_time      TIMESTAMPTZ  NOT NULL,
    team           VARCHAR(120) NOT NULL,
    opponent       VARCHAR(120) NOT NULL,
    is_home        BOOLEAN      NOT NULL,
    player_id      VARCHAR(32)  NOT NULL,         -- ESPN athlete id
    player_name    VARCHAR(120) NOT NULL,
    starter        BOOLEAN,
    did_not_play   BOOLEAN      NOT NULL DEFAULT FALSE,
    dnp_reason     VARCHAR(120),
    minutes        INTEGER,
    points         INTEGER,
    rebounds       INTEGER,
    assists        INTEGER,
    threes_made    INTEGER,
    threes_att     INTEGER,
    fg_made        INTEGER,
    fg_att         INTEGER,
    ft_made        INTEGER,
    ft_att         INTEGER,
    off_rebounds   INTEGER,
    def_rebounds   INTEGER,
    steals         INTEGER,
    blocks         INTEGER,
    turnovers      INTEGER,
    fouls          INTEGER,
    plus_minus     INTEGER,
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (sport_key, espn_event_id, player_id)
);
CREATE INDEX IF NOT EXISTS ix_msbox_player ON multisport_player_boxscores (sport_key, player_id, game_time);
CREATE INDEX IF NOT EXISTS ix_msbox_name ON multisport_player_boxscores (sport_key, player_name, game_time);
CREATE INDEX IF NOT EXISTS ix_msbox_event ON multisport_player_boxscores (event_id);
