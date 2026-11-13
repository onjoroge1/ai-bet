-- Kalshi captures beyond the full-game winner: spreads, totals, team totals and
-- half/quarter/period winners. Ladder markets ("Chicago wins by over 7.5") carry
-- their line in `line`; `team` is NULL for game totals and "Tie" outcomes.
-- game_key ("26NOV13ATLCHI") ties every series for one game together.
ALTER TABLE multisport_kalshi_snapshots ADD COLUMN IF NOT EXISTS market_type VARCHAR(24) NOT NULL DEFAULT 'game';
ALTER TABLE multisport_kalshi_snapshots ADD COLUMN IF NOT EXISTS line        NUMERIC(8,2);
ALTER TABLE multisport_kalshi_snapshots ADD COLUMN IF NOT EXISTS outcome     VARCHAR(120);
ALTER TABLE multisport_kalshi_snapshots ADD COLUMN IF NOT EXISTS game_key    VARCHAR(100);
UPDATE multisport_kalshi_snapshots SET game_key = split_part(kalshi_event, '-', 2) WHERE game_key IS NULL;
CREATE INDEX IF NOT EXISTS ix_mskalshi_game_key ON multisport_kalshi_snapshots (sport_key, game_key);
CREATE INDEX IF NOT EXISTS ix_msos_ts ON multisport_odds_snapshots (ts_recorded);
CREATE INDEX IF NOT EXISTS ix_mskalshi_ts ON multisport_kalshi_snapshots (ts_recorded);
