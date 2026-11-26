-- NFL player game stats from ESPN box scores, for grading NFL player props (research, paper only).
-- ESPN lists only players who recorded a stat, so a player missing here is graded void, not 0.
CREATE TABLE IF NOT EXISTS multisport_nfl_player_stats (
    id             BIGSERIAL PRIMARY KEY,
    sport_key      VARCHAR(64)  NOT NULL DEFAULT 'americanfootball_nfl',
    espn_event_id  VARCHAR(32)  NOT NULL,
    event_id       VARCHAR(100),                  -- linked multisport_fixtures row, when found
    game_time      TIMESTAMPTZ  NOT NULL,
    team           VARCHAR(120) NOT NULL,
    opponent       VARCHAR(120) NOT NULL,
    is_home        BOOLEAN      NOT NULL,
    player_id      VARCHAR(32)  NOT NULL,         -- ESPN athlete id
    player_name    VARCHAR(120) NOT NULL,
    pass_cmp       INTEGER, pass_att INTEGER, pass_yds INTEGER, pass_td INTEGER, interceptions INTEGER,
    rush_att       INTEGER, rush_yds INTEGER, rush_td INTEGER,
    receptions     INTEGER, targets INTEGER, rec_yds INTEGER, rec_td INTEGER,
    return_td      INTEGER,                       -- kick + punt return touchdowns
    def_td         INTEGER,                       -- defensive / interception return touchdowns
    scoring_td     INTEGER,                       -- rush + receiving + return + defensive TDs (anytime TD; passing TDs excluded)
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (espn_event_id, player_id)
);
CREATE INDEX IF NOT EXISTS ix_msnfl_event ON multisport_nfl_player_stats (event_id);
CREATE INDEX IF NOT EXISTS ix_msnfl_player ON multisport_nfl_player_stats (player_id, game_time);

-- NFL anytime-TD lines are mostly Yes-only: those prop_results rows have no under side.
ALTER TABLE multisport_prop_results ALTER COLUMN under_prob DROP NOT NULL;
