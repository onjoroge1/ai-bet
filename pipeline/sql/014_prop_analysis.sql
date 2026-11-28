-- Prop analysis (research, paper only). See snapbet_pipeline/prop_analysis/.
--
-- 1. multisport_kalshi_markets: one row per Kalshi market (game, spread, total, team total, period,
--    and player props): the original ticker, rules text, and Kalshi's own settlement.
-- 2. quote_source on multisport_kalshi_snapshots: 'live' (our hourly capture) or 'candle_1h'
--    (Kalshi's public hourly candle, backfilled: the bid/ask at the end of that hour).
-- 3. multisport_prop_actuals: each player's stat for each prop market and game, from box scores.
-- 4. multisport_prop_records (VIEW): the common record for every quote we hold, sportsbook and Kalshi,
--    player and game markets, with its settlement.
-- 5. multisport_prop_estimates / multisport_prop_lines: model estimates (one distribution per
--    player-game or team-game and statistic) and every quoted line priced against them.
-- 6. multisport_prop_reports: evaluation and event-study reports (JSON).

CREATE TABLE IF NOT EXISTS multisport_kalshi_markets (
    ticker            VARCHAR(120) PRIMARY KEY,
    event_ticker      VARCHAR(120) NOT NULL,
    series_ticker     VARCHAR(60)  NOT NULL,
    sport_key         VARCHAR(64)  NOT NULL,
    event_id          VARCHAR(100),                  -- linked multisport_fixtures row, when found
    game_key          VARCHAR(100),
    market_type       VARCHAR(32)  NOT NULL,         -- game | spread | total | team_total | 1h | 1q | 1p | player_<stat>
    player_name       VARCHAR(120),                  -- player props only
    team_code         VARCHAR(16),
    strike            NUMERIC(8,2),                  -- floor_strike: Yes when the value is above it
    strike_type       VARCHAR(24),
    title             TEXT,
    yes_sub_title     TEXT,
    rules_primary     TEXT,
    rules_secondary   TEXT,
    open_time         TIMESTAMPTZ,
    close_time        TIMESTAMPTZ,
    occurrence_time   TIMESTAMPTZ,
    status            VARCHAR(32),
    result            VARCHAR(16),                   -- yes | no | '' (void / fair price) | NULL (unsettled)
    settlement_value  NUMERIC(6,4),                  -- dollars per contract paid to Yes (0, 1, or a fair price)
    expiration_value  VARCHAR(64),                   -- Kalshi's recorded outcome (e.g. a stat or a score)
    settled_at        TIMESTAMPTZ,
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_mskm_event ON multisport_kalshi_markets (event_id);
CREATE INDEX IF NOT EXISTS ix_mskm_game ON multisport_kalshi_markets (sport_key, game_key);

ALTER TABLE multisport_kalshi_snapshots ADD COLUMN IF NOT EXISTS quote_source VARCHAR(16) NOT NULL DEFAULT 'live';
CREATE INDEX IF NOT EXISTS ix_mskalshi_ticker_ts ON multisport_kalshi_snapshots (kalshi_ticker, ts_recorded);

CREATE TABLE IF NOT EXISTS multisport_prop_actuals (
    sport_key    VARCHAR(64)  NOT NULL,
    event_id     VARCHAR(100) NOT NULL,
    market       VARCHAR(64)  NOT NULL,              -- player_points, player_pass_yds, ...
    player_name  VARCHAR(120) NOT NULL,              -- as the books spell it
    actual       NUMERIC(8,2),                       -- NULL when void
    status       VARCHAR(8)   NOT NULL,              -- played | void (not in box score / did not play)
    graded_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (event_id, market, player_name)
);

DROP VIEW IF EXISTS multisport_prop_records;
CREATE VIEW multisport_prop_records AS
-- sportsbook player props: Yes = over, No = under (decimal odds); one row per book x line x pull
SELECT 'sb:' || p.id AS record_id, p.sport_key, p.event_id, p.commence_time, p.home_team, p.away_team,
       'player'::text AS subject_type, p.player_name AS subject, p.market AS stat, p.line AS threshold,
       'over'::text AS direction, 'sportsbook'::text AS source, p.bookmaker AS book,
       p.event_id || '|' || p.bookmaker || '|' || p.market || '|' || p.player_name || '|' || p.line AS market_id,
       NULL::text AS rules, p.ts_recorded AS quote_ts, 'decimal'::text AS price_format,
       p.over_price AS yes_price, p.under_price AS no_price,
       CASE WHEN p.over_price > 1 AND p.under_price > 1
            THEN ROUND(((1 / p.over_price) / (1 / p.over_price + 1 / p.under_price))::numeric, 4) END AS displayed_prob,
       a.actual,
       CASE WHEN a.status = 'void' THEN 'void' WHEN a.actual IS NULL THEN NULL
            WHEN a.actual > p.line THEN 'yes' WHEN a.actual < p.line THEN 'no' ELSE 'push' END AS result,
       CASE WHEN a.status = 'void' THEN 'void' WHEN a.actual IS NOT NULL THEN 'settled' ELSE 'pending' END AS settlement_status
  FROM multisport_player_props p
  LEFT JOIN multisport_prop_actuals a ON a.event_id = p.event_id AND a.market = p.market AND a.player_name = p.player_name
 WHERE p.line IS NOT NULL
UNION ALL
-- sportsbook game markets (one row per book x pull x market): moneyline, spread, total
SELECT 'sbg:' || o.id || ':' || m.stat, o.sport_key, o.event_id, o.commence_time, o.home_team, o.away_team,
       m.subject_type, m.subject, m.stat, m.threshold, 'over', 'sportsbook', o.bookmaker,
       o.event_id || '|' || o.bookmaker || '|' || m.stat || '|' || COALESCE(m.threshold::text, ''),
       NULL, o.ts_recorded, 'decimal', m.yes_price, m.no_price,
       CASE WHEN m.yes_price > 1 AND m.no_price > 1
            THEN ROUND(((1 / m.yes_price) / (1 / m.yes_price + 1 / m.no_price))::numeric, 4) END,
       m.actual,
       CASE WHEN m.actual IS NULL THEN NULL WHEN m.actual > m.threshold THEN 'yes'
            WHEN m.actual < m.threshold THEN 'no' ELSE 'push' END,
       CASE WHEN m.actual IS NOT NULL THEN 'settled' ELSE 'pending' END
  FROM multisport_odds_snapshots o
  LEFT JOIN multisport_match_results r ON r.event_id = o.event_id AND r.home_score IS NOT NULL
  CROSS JOIN LATERAL (VALUES
      ('team', o.home_team, 'team_win', 0::numeric, o.home_odds, o.away_odds,
       (SIGN(r.home_score - r.away_score))::numeric),
      ('team', o.home_team, 'team_margin', -o.home_spread, o.home_spread_odds, o.away_spread_odds,
       (r.home_score - r.away_score)::numeric),
      ('game', 'game', 'game_total', o.total_line, o.over_odds, o.under_odds,
       (r.home_score + r.away_score)::numeric)
  ) AS m(subject_type, subject, stat, threshold, yes_price, no_price, actual)
 WHERE NOT o.is_consensus AND m.yes_price IS NOT NULL AND m.threshold IS NOT NULL
UNION ALL
-- Kalshi (game, spread, total, team total, periods, player props): Yes = yes_ask, No = 1 - yes_bid (dollars)
SELECT 'k:' || s.id, s.sport_key, COALESCE(s.event_id, km.event_id), f.commence_time, f.home_team, f.away_team,
       CASE WHEN s.market_type LIKE 'player_%' THEN 'player' WHEN s.market_type = 'total' THEN 'game' ELSE 'team' END,
       COALESCE(km.player_name, s.team, 'game'),
       CASE s.market_type WHEN 'game' THEN 'team_win' WHEN 'spread' THEN 'team_margin' WHEN 'total' THEN 'game_total'
                          WHEN 'team_total' THEN 'team_points' ELSE s.market_type END,
       COALESCE(km.strike, s.line, CASE WHEN s.market_type = 'game' THEN 0 END),
       'yes', 'kalshi', 'kalshi', s.kalshi_ticker, km.rules_primary, s.ts_recorded, 'dollars',
       s.yes_ask, CASE WHEN s.yes_bid IS NOT NULL THEN 1 - s.yes_bid END,
       COALESCE(NULLIF(s.last_price, 0), (s.yes_bid + s.yes_ask) / 2),
       NULL::numeric,
       CASE WHEN km.result IN ('yes', 'no') THEN km.result WHEN km.result = '' THEN 'fair' END,
       CASE WHEN km.result IN ('yes', 'no') THEN 'settled'
            WHEN km.result = '' AND km.settlement_value IS NOT NULL THEN 'fair_price'
            WHEN km.result = '' THEN 'void' ELSE 'pending' END
  FROM multisport_kalshi_snapshots s
  LEFT JOIN multisport_kalshi_markets km ON km.ticker = s.kalshi_ticker
  LEFT JOIN multisport_fixtures f ON f.event_id = COALESCE(s.event_id, km.event_id);

CREATE TABLE IF NOT EXISTS multisport_prop_estimates (
    id              BIGSERIAL PRIMARY KEY,
    sport_key       VARCHAR(64)  NOT NULL,
    event_id        VARCHAR(100) NOT NULL,
    commence_time   TIMESTAMPTZ  NOT NULL,
    home_team       VARCHAR(120),
    away_team       VARCHAR(120),
    subject_type    VARCHAR(8)   NOT NULL,           -- player | team | game
    subject         VARCHAR(120) NOT NULL,           -- player name (as the books spell it), team, or 'game'
    team            VARCHAR(120),
    opponent        VARCHAR(120),
    is_home         BOOLEAN,
    stat            VARCHAR(40)  NOT NULL,           -- player_points ... | team_win | team_margin | team_points | game_total
    mode            VARCHAR(10)  NOT NULL,           -- live (upcoming games) | backtest (walk-forward)
    model_version   VARCHAR(40)  NOT NULL,
    prediction_ts   TIMESTAMPTZ  NOT NULL,           -- information cut-off: nothing later was used
    mean            NUMERIC(10,3),
    dist            VARCHAR(16),                     -- negbin | poisson | empirical | normal
    dist_params     JSONB,
    curve           JSONB,                           -- [{t, p, lo, hi}]: P(stat > t) with a refit range
    hit_rate        JSONB,                           -- historical hit rates at the main line, overall and by condition
    factors         JSONB,                           -- what moved the estimate (stat units)
    combos          JSONB,                           -- joint probabilities with related lines (same player / teammates)
    history         JSONB,                           -- live mode: [{ts, mean, p_main, market_main}] each run
    actual          NUMERIC(10,3),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, subject, stat, mode)
);
CREATE INDEX IF NOT EXISTS ix_mspe_time ON multisport_prop_estimates (mode, commence_time);

CREATE TABLE IF NOT EXISTS multisport_prop_lines (
    id              BIGSERIAL PRIMARY KEY,
    estimate_id     BIGINT       NOT NULL REFERENCES multisport_prop_estimates (id) ON DELETE CASCADE,
    source          VARCHAR(16)  NOT NULL,           -- sportsbook | kalshi
    book            VARCHAR(64)  NOT NULL,
    market_id       TEXT         NOT NULL,           -- Kalshi ticker, or event|book|market|player|line
    threshold       NUMERIC(8,2) NOT NULL,
    side            VARCHAR(3)   NOT NULL,           -- yes (over) | no (under)
    quote_ts        TIMESTAMPTZ  NOT NULL,
    price           NUMERIC(8,4) NOT NULL,           -- decimal odds (sportsbook) or ask in dollars (Kalshi)
    price_format    VARCHAR(8)   NOT NULL,
    fee             NUMERIC(8,4) NOT NULL DEFAULT 0, -- Kalshi taker fee per contract; books: 0 (margin is in the price)
    breakeven_prob  NUMERIC(6,4) NOT NULL,           -- win rate needed to break even after fees
    displayed_prob  NUMERIC(6,4),                    -- market's displayed probability (no-vig average / Kalshi last)
    our_prob        NUMERIC(6,4),
    our_lo          NUMERIC(6,4),
    our_hi          NUMERIC(6,4),
    ev              NUMERIC(8,4),                    -- expected profit per $1 staked, after fees
    result          VARCHAR(8),                      -- win | loss | push | void | fair
    pnl             NUMERIC(8,4),                    -- profit per $1 staked once settled
    UNIQUE (estimate_id, book, market_id, side)
);
CREATE INDEX IF NOT EXISTS ix_mspl_estimate ON multisport_prop_lines (estimate_id);

CREATE TABLE IF NOT EXISTS multisport_prop_reports (
    id          BIGSERIAL PRIMARY KEY,
    kind        VARCHAR(32)  NOT NULL,               -- evaluation | events
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    report      JSONB        NOT NULL
);
