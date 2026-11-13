-- Snapbet multisport pipeline tables. Idempotent: safe to run on every job start.
-- These mirror the tables the BetGeniusAI backend created ad hoc on Replit
-- (reconstructed from its INSERT/SELECT statements); they live in the frontend
-- Postgres next to the Prisma-managed tables and are NOT managed by Prisma.

CREATE TABLE IF NOT EXISTS multisport_fixtures (
    id            BIGSERIAL PRIMARY KEY,
    sport         VARCHAR(32)  NOT NULL,          -- family: basketball | american-football | hockey
    sport_key     VARCHAR(64)  NOT NULL,          -- The Odds API key, e.g. americanfootball_nfl
    event_id      VARCHAR(100) NOT NULL,          -- The Odds API event id
    home_team     VARCHAR(120) NOT NULL,
    away_team     VARCHAR(120) NOT NULL,
    commence_time TIMESTAMPTZ  NOT NULL,
    league_name   VARCHAR(120),
    home_score    INTEGER,
    away_score    INTEGER,
    outcome       CHAR(1),                        -- 'H' | 'A'
    status        VARCHAR(20)  NOT NULL DEFAULT 'scheduled',  -- scheduled | finished
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (sport, event_id)
);
CREATE INDEX IF NOT EXISTS ix_msf_sportkey_commence ON multisport_fixtures (sport_key, commence_time);
CREATE INDEX IF NOT EXISTS ix_msf_sportkey_status   ON multisport_fixtures (sport_key, status);

CREATE TABLE IF NOT EXISTS multisport_odds_snapshots (
    id               BIGSERIAL PRIMARY KEY,
    sport            VARCHAR(32)  NOT NULL,
    sport_key        VARCHAR(64)  NOT NULL,
    event_id         VARCHAR(100) NOT NULL,
    home_team        VARCHAR(120),
    away_team        VARCHAR(120),
    commence_time    TIMESTAMPTZ,
    home_odds        NUMERIC(8,3),
    away_odds        NUMERIC(8,3),
    draw_odds        NUMERIC(8,3),
    home_prob        NUMERIC(6,4),
    away_prob        NUMERIC(6,4),
    draw_prob        NUMERIC(6,4),
    home_spread      NUMERIC(6,2),
    home_spread_odds NUMERIC(8,3),
    away_spread_odds NUMERIC(8,3),
    total_line       NUMERIC(6,2),
    over_odds        NUMERIC(8,3),
    under_odds       NUMERIC(8,3),
    overround        NUMERIC(6,4),
    n_bookmakers     INTEGER,
    bookmaker        VARCHAR(64)  NOT NULL,       -- 'consensus' or a book key
    is_consensus     BOOLEAN      NOT NULL DEFAULT FALSE,
    ts_recorded      TIMESTAMPTZ  NOT NULL,
    UNIQUE (event_id, bookmaker, ts_recorded)
);
CREATE INDEX IF NOT EXISTS ix_msos_event_ts     ON multisport_odds_snapshots (event_id, ts_recorded);
CREATE INDEX IF NOT EXISTS ix_msos_sportkey_ts  ON multisport_odds_snapshots (sport_key, ts_recorded);
CREATE INDEX IF NOT EXISTS ix_msos_event_cons   ON multisport_odds_snapshots (event_id, is_consensus, ts_recorded DESC);

CREATE TABLE IF NOT EXISTS multisport_match_results (
    id          BIGSERIAL PRIMARY KEY,
    sport_key   VARCHAR(64)  NOT NULL,
    event_id    VARCHAR(100) NOT NULL,
    game_date   TIMESTAMPTZ  NOT NULL,
    home_team   VARCHAR(120) NOT NULL,
    away_team   VARCHAR(120) NOT NULL,
    home_score  INTEGER,
    away_score  INTEGER,
    result      CHAR(1),                          -- 'H' | 'A'
    status      VARCHAR(20)  NOT NULL,            -- final
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (sport_key, event_id)
);
CREATE INDEX IF NOT EXISTS ix_msmr_sportkey_date ON multisport_match_results (sport_key, game_date);

CREATE TABLE IF NOT EXISTS multisport_schedule (
    id            BIGSERIAL PRIMARY KEY,
    sport_key     VARCHAR(64)  NOT NULL,
    event_id      VARCHAR(100) NOT NULL,
    home_team     VARCHAR(120) NOT NULL,
    away_team     VARCHAR(120) NOT NULL,
    commence_time TIMESTAMPTZ  NOT NULL,
    status        VARCHAR(20)  NOT NULL,          -- scheduled | in_progress | final
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (sport_key, event_id)
);

CREATE TABLE IF NOT EXISTS multisport_training (
    id                   BIGSERIAL PRIMARY KEY,
    sport                VARCHAR(32)  NOT NULL,
    sport_key            VARCHAR(64)  NOT NULL,
    event_id             VARCHAR(100) NOT NULL,
    home_team            VARCHAR(120) NOT NULL,
    away_team            VARCHAR(120) NOT NULL,
    match_date           DATE         NOT NULL,
    home_score           INTEGER,
    away_score           INTEGER,
    outcome              CHAR(1)      NOT NULL,   -- 'H' | 'A'
    features             JSONB,                   -- 46-feature vector, built leak-safe at match_date
    features_version     VARCHAR(16),
    consensus_home_prob  NUMERIC(6,4),
    consensus_away_prob  NUMERIC(6,4),
    consensus_draw_prob  NUMERIC(6,4),
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (sport_key, event_id)
);
CREATE INDEX IF NOT EXISTS ix_mst_sportkey_date ON multisport_training (sport_key, match_date);
CREATE INDEX IF NOT EXISTS ix_mst_teams ON multisport_training (sport_key, home_team, away_team);

-- Observability: one row per job run (GitHub Actions or local).
CREATE TABLE IF NOT EXISTS multisport_pipeline_runs (
    id          BIGSERIAL PRIMARY KEY,
    job         VARCHAR(64)  NOT NULL,
    status      VARCHAR(16)  NOT NULL,            -- ok | error | skipped
    started_at  TIMESTAMPTZ  NOT NULL,
    finished_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    metrics     JSONB,
    error       TEXT
);
CREATE INDEX IF NOT EXISTS ix_mspr_job_started ON multisport_pipeline_runs (job, started_at DESC);
