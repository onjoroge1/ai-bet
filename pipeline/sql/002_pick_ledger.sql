-- Pick ledger: one row per (sport, event) recording what we published and when,
-- the price available at that moment, the closing line, and the realized CLV.
-- This is the evidence trail behind model_track_record (n_settled, median_clv_90d).
-- Written by publish (first publish locks bet-time fields) and settle.

CREATE TABLE IF NOT EXISTS multisport_pick_ledger (
    id                   BIGSERIAL PRIMARY KEY,
    sport_key            VARCHAR(64)  NOT NULL,
    event_id             VARCHAR(100) NOT NULL,
    home_team            VARCHAR(120) NOT NULL,
    away_team            VARCHAR(120) NOT NULL,
    commence_time        TIMESTAMPTZ  NOT NULL,
    model_id             VARCHAR(64),
    first_published_at   TIMESTAMPTZ  NOT NULL,
    last_published_at    TIMESTAMPTZ  NOT NULL,
    publish_count        INTEGER      NOT NULL DEFAULT 1,
    -- model pick at FIRST publish (never overwritten)
    model_pick           CHAR(1),                       -- 'H' | 'A'
    model_prob_pick      NUMERIC(6,4),
    market_prob_pick     NUMERIC(6,4),                  -- de-vigged consensus for the picked side at first publish
    -- value bet at the FIRST publish that carried one (never overwritten)
    value_bet_outcome    VARCHAR(8),                    -- 'home' | 'away'
    value_bet_at         TIMESTAMPTZ,
    bet_time_odds        NUMERIC(8,3),                  -- best price when the value bet first appeared
    bet_time_book        VARCHAR(64),
    bet_time_ev          NUMERIC(8,4),
    bet_time_model_prob  NUMERIC(6,4),
    edge_validated_at_bet BOOLEAN,
    -- settlement
    closing_prob_pick    NUMERIC(6,4),                  -- de-vigged consensus for model pick side at close
    closing_prob_bet     NUMERIC(6,4),                  -- ... for the value-bet side
    closing_odds_bet     NUMERIC(8,3),                  -- consensus (vig-included) odds for the value-bet side at close
    closing_ts           TIMESTAMPTZ,
    closing_method       VARCHAR(32),                   -- 'last_pre_commence' | 'latest_available'
    realized_clv         NUMERIC(8,4),                  -- bet_time_odds * closing_prob_bet - 1
    result               CHAR(1),                       -- 'H' | 'A'
    pick_won             BOOLEAN,
    value_bet_won        BOOLEAN,
    value_bet_pnl_1u     NUMERIC(8,4),                  -- at bet_time_odds
    settled_at           TIMESTAMPTZ,
    UNIQUE (sport_key, event_id)
);
CREATE INDEX IF NOT EXISTS ix_mspl_sport_settled ON multisport_pick_ledger (sport_key, settled_at DESC);
CREATE INDEX IF NOT EXISTS ix_mspl_unsettled ON multisport_pick_ledger (sport_key, commence_time) WHERE settled_at IS NULL;
