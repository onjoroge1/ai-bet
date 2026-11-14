-- ESPN injury reports. One row per player x injury report x status; hourly runs only
-- bump last_seen, so a status change (Day-To-Day -> Out) adds a row and history is kept.
CREATE TABLE IF NOT EXISTS multisport_injuries (
    id               BIGSERIAL PRIMARY KEY,
    sport_key        VARCHAR(64)  NOT NULL,
    team             VARCHAR(120) NOT NULL,
    player_id        VARCHAR(32)  NOT NULL,          -- ESPN athlete id
    player_name      VARCHAR(120) NOT NULL,
    position         VARCHAR(8),
    status           VARCHAR(32)  NOT NULL,          -- Out | Day-To-Day | Suspension | ...
    fantasy_status   VARCHAR(16),                    -- OUT | GTD | ...
    injury_type      VARCHAR(64),
    return_date      DATE,
    short_comment    TEXT,
    espn_injury_id   VARCHAR(32)  NOT NULL,
    report_time      TIMESTAMPTZ,
    first_seen       TIMESTAMPTZ  NOT NULL,
    last_seen        TIMESTAMPTZ  NOT NULL,
    UNIQUE (sport_key, player_id, espn_injury_id, status)
);
CREATE INDEX IF NOT EXISTS ix_msinj_team ON multisport_injuries (sport_key, team, last_seen);
