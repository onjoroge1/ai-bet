"""Pick ledger: lock bet-time prices, capture the closing line, realize CLV.

Why a separate table: MultisportMatch.predictionData is overwritten every
publish run, so the "price when we said bet" would drift toward the close and
CLV would be meaningless. The ledger records the FIRST publish of a model pick
and the FIRST appearance of a value bet, and never overwrites those fields.

Closing line: the last consensus snapshot recorded at or before commence_time
(method 'last_pre_commence'); if none exists (collector was down) the latest
snapshot available is used and flagged ('latest_available').

Realized CLV = bet_time_odds * closing_prob_bet - 1, i.e. the bet-time price
measured against the de-vigged closing probability. Positive means we beat
the close — the standard evidence that an edge is real, independent of the
bet's result.

Track record (90d window): n_settled model picks, hit rates, value-bet count,
median realized CLV and 1u ROI at bet-time prices. publish/predict read it to
fill model_track_record.{n_settled, median_clv_90d}. A model whose settled
value bets show negative median CLV on >= CLV_GATE_MIN_N bets is reported as
edge_validated=false even if its training gate passed.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Dict, Optional

if TYPE_CHECKING:  # pragma: no cover
    from .predict import Prediction

logger = logging.getLogger(__name__)

CLV_GATE_MIN_N = 50          # value bets settled before CLV can veto edge_validated
TRACK_WINDOW_DAYS = 90


# --------------------------------------------------------------------------- publish side
def record_publish(cur, p: "Prediction") -> None:
    """Insert or update the ledger row for one published prediction."""
    preds = (p.model_block or {}).get("predictions") or {}
    model_pick = preds.get("pick") if preds.get("pick") in ("H", "A") else None
    model_prob_pick = preds.get("home_win") if model_pick == "H" else preds.get("away_win") if model_pick == "A" else None
    market = p.prediction_data.get("market") or {}
    implied = market.get("implied") or {}
    market_prob_pick = implied.get("home") if model_pick == "H" else implied.get("away") if model_pick == "A" else None
    value = p.prediction_data.get("value") or {}
    vb = value.get("value_bet") or None
    track = p.prediction_data.get("model_track_record") or {}
    model_id = track.get("model") or (p.model_block or {}).get("model_id")
    now = p.generated_at

    cur.execute(
        """
        INSERT INTO multisport_pick_ledger (
            sport_key, event_id, home_team, away_team, commence_time, model_id,
            first_published_at, last_published_at, publish_count,
            model_pick, model_prob_pick, market_prob_pick,
            value_bet_outcome, value_bet_at, bet_time_odds, bet_time_book, bet_time_ev, bet_time_model_prob,
            edge_validated_at_bet)
        VALUES (%s,%s,%s,%s,%s,%s, %s,%s,1, %s,%s,%s, %s,%s,%s,%s,%s,%s, %s)
        ON CONFLICT (sport_key, event_id) DO UPDATE SET
            last_published_at = EXCLUDED.last_published_at,
            publish_count     = multisport_pick_ledger.publish_count + 1,
            model_id          = COALESCE(multisport_pick_ledger.model_id, EXCLUDED.model_id),
            -- model pick: locked at first publish WITH a model (cold-start rows may precede it)
            model_pick        = COALESCE(multisport_pick_ledger.model_pick, EXCLUDED.model_pick),
            model_prob_pick   = COALESCE(multisport_pick_ledger.model_prob_pick, EXCLUDED.model_prob_pick),
            market_prob_pick  = COALESCE(multisport_pick_ledger.market_prob_pick, EXCLUDED.market_prob_pick),
            -- value bet: locked at the first publish that carried one
            value_bet_outcome   = COALESCE(multisport_pick_ledger.value_bet_outcome, EXCLUDED.value_bet_outcome),
            value_bet_at        = COALESCE(multisport_pick_ledger.value_bet_at, EXCLUDED.value_bet_at),
            bet_time_odds       = COALESCE(multisport_pick_ledger.bet_time_odds, EXCLUDED.bet_time_odds),
            bet_time_book       = COALESCE(multisport_pick_ledger.bet_time_book, EXCLUDED.bet_time_book),
            bet_time_ev         = COALESCE(multisport_pick_ledger.bet_time_ev, EXCLUDED.bet_time_ev),
            bet_time_model_prob = COALESCE(multisport_pick_ledger.bet_time_model_prob, EXCLUDED.bet_time_model_prob),
            edge_validated_at_bet = COALESCE(multisport_pick_ledger.edge_validated_at_bet, EXCLUDED.edge_validated_at_bet)
        WHERE multisport_pick_ledger.settled_at IS NULL
        """,
        (p.sport_key, p.event_id, p.home_team, p.away_team, p.commence_time, model_id,
         now, now,
         model_pick, model_prob_pick, market_prob_pick,
         vb.get("outcome") if vb else None, now if vb else None,
         vb.get("price") if vb else None, vb.get("book") if vb else None, vb.get("ev") if vb else None,
         (preds.get("home_win") if vb.get("outcome") == "home" else preds.get("away_win")) if vb else None,
         bool(track.get("edge_validated")) if vb else None),
    )


# --------------------------------------------------------------------------- settlement
def _closing_snapshot(cur, sport_key: str, event_id: str, commence_time: datetime):
    cur.execute(
        """SELECT home_prob, away_prob, home_odds, away_odds, ts_recorded
             FROM multisport_odds_snapshots
            WHERE sport_key = %s AND event_id = %s AND is_consensus AND ts_recorded <= %s
            ORDER BY ts_recorded DESC LIMIT 1""", (sport_key, event_id, commence_time))
    row = cur.fetchone()
    if row:
        return row, "last_pre_commence"
    cur.execute(
        """SELECT home_prob, away_prob, home_odds, away_odds, ts_recorded
             FROM multisport_odds_snapshots
            WHERE sport_key = %s AND event_id = %s AND is_consensus
            ORDER BY ts_recorded DESC LIMIT 1""", (sport_key, event_id))
    row = cur.fetchone()
    return (row, "latest_available") if row else (None, None)


def settle_ledger(conn, sport_key: str) -> Dict[str, int]:
    """Settle ledger rows whose fixture is finished: closing line, result, CLV, P&L."""
    with conn.cursor() as cur:
        cur.execute(
            """SELECT l.id, l.event_id, l.commence_time, l.model_pick, l.value_bet_outcome, l.bet_time_odds,
                      f.outcome
                 FROM multisport_pick_ledger l
                 JOIN multisport_fixtures f ON f.sport_key = l.sport_key AND f.event_id = l.event_id
                WHERE l.sport_key = %s AND l.settled_at IS NULL
                  AND f.status = 'finished' AND f.outcome IN ('H','A')""", (sport_key,))
        rows = cur.fetchall()
        settled = no_close = 0
        for lid, event_id, commence, model_pick, vb_outcome, bet_odds, result in rows:
            snap, method = _closing_snapshot(cur, sport_key, event_id, commence)
            closing_prob_pick = closing_prob_bet = closing_odds_bet = closing_ts = realized_clv = None
            if snap:
                hp, ap, ho, ao, ts = snap
                hp, ap = float(hp) if hp is not None else None, float(ap) if ap is not None else None
                if model_pick:
                    closing_prob_pick = hp if model_pick == "H" else ap
                if vb_outcome:
                    closing_prob_bet = hp if vb_outcome == "home" else ap
                    closing_odds_bet = float(ho) if vb_outcome == "home" and ho else (float(ao) if vb_outcome == "away" and ao else None)
                    if bet_odds and closing_prob_bet:
                        realized_clv = round(float(bet_odds) * closing_prob_bet - 1.0, 4)
                closing_ts = ts
            else:
                no_close += 1
            pick_won = (model_pick == result) if model_pick else None
            vb_won = None
            pnl = None
            if vb_outcome:
                vb_won = (vb_outcome == "home" and result == "H") or (vb_outcome == "away" and result == "A")
                if bet_odds:
                    pnl = round(float(bet_odds) - 1.0, 4) if vb_won else -1.0
            cur.execute(
                """UPDATE multisport_pick_ledger
                      SET closing_prob_pick = %s, closing_prob_bet = %s, closing_odds_bet = %s, closing_ts = %s,
                          closing_method = %s, realized_clv = %s, result = %s, pick_won = %s,
                          value_bet_won = %s, value_bet_pnl_1u = %s, settled_at = NOW()
                    WHERE id = %s""",
                (closing_prob_pick, closing_prob_bet, closing_odds_bet, closing_ts, method, realized_clv,
                 result, pick_won, vb_won, pnl, lid))
            settled += 1

            # mirror the realized CLV onto the frontend row's clv block
            if vb_outcome:
                cur.execute(
                    """UPDATE "MultisportMatch"
                          SET "predictionData" = jsonb_set(
                                jsonb_set(COALESCE("predictionData", '{}'::jsonb), '{clv}',
                                          COALESCE("predictionData"->'clv', '{}'::jsonb) ||
                                          jsonb_build_object('bet_time_odds', %s::numeric,
                                                             'closing_odds', %s::numeric,
                                                             'closing_prob', %s::numeric,
                                                             'realized_clv', %s::numeric,
                                                             'closing_method', %s::text)),
                                '{model_track_record,n_settled}', 'null'::jsonb, true),
                              "updatedAt" = NOW()
                        WHERE "eventId" = %s AND sport = %s""",
                    (float(bet_odds) if bet_odds else None, closing_odds_bet, closing_prob_bet, realized_clv,
                     method, event_id, sport_key))
    conn.commit()
    return {"candidates": len(rows), "settled": settled, "without_closing_line": no_close}


# --------------------------------------------------------------------------- track record
def track_record(conn, sport_key: str, now: Optional[datetime] = None, window_days: int = TRACK_WINDOW_DAYS) -> Dict:
    """90-day settled record for a sport. All numbers come from the ledger."""
    now = now or datetime.now(timezone.utc)
    since = now - timedelta(days=window_days)
    with conn.cursor() as cur:
        cur.execute(
            """SELECT COUNT(*) FILTER (WHERE model_pick IS NOT NULL),
                      COUNT(*) FILTER (WHERE pick_won),
                      COUNT(*) FILTER (WHERE model_pick IS NOT NULL AND market_prob_pick IS NOT NULL
                                         AND ((market_prob_pick >= 0.5) = pick_won)),
                      -- value-bet and CLV stats count only bets the site offered, i.e. placed
                      -- while the model's gate had passed; unvalidated rows stay in the ledger
                      COUNT(*) FILTER (WHERE value_bet_outcome IS NOT NULL AND edge_validated_at_bet),
                      COUNT(*) FILTER (WHERE value_bet_won AND edge_validated_at_bet),
                      COALESCE(SUM(value_bet_pnl_1u) FILTER (WHERE value_bet_outcome IS NOT NULL
                                                              AND edge_validated_at_bet), 0),
                      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY realized_clv)
                          FILTER (WHERE realized_clv IS NOT NULL AND edge_validated_at_bet),
                      AVG(realized_clv) FILTER (WHERE realized_clv IS NOT NULL AND edge_validated_at_bet),
                      COUNT(*) FILTER (WHERE realized_clv IS NOT NULL AND realized_clv > 0 AND edge_validated_at_bet),
                      COUNT(*) FILTER (WHERE realized_clv IS NOT NULL AND edge_validated_at_bet)
                 FROM multisport_pick_ledger
                WHERE sport_key = %s AND settled_at IS NOT NULL AND commence_time >= %s""",
            (sport_key, since))
        (n_picks, n_hits, _unused, n_vb, n_vb_won, pnl, med_clv, mean_clv, n_clv_pos, n_clv) = cur.fetchone()
    n_picks, n_vb, n_clv = int(n_picks or 0), int(n_vb or 0), int(n_clv or 0)
    return {
        "window_days": window_days,
        "n_settled": n_picks,
        "pick_hit_rate": round(int(n_hits or 0) / n_picks, 4) if n_picks else None,
        "n_value_bets": n_vb,
        "value_bet_hit_rate": round(int(n_vb_won or 0) / n_vb, 4) if n_vb else None,
        "value_bet_roi_1u": round(float(pnl) / n_vb, 4) if n_vb else None,
        "median_clv_90d": round(float(med_clv), 4) if med_clv is not None else None,
        "mean_clv_90d": round(float(mean_clv), 4) if mean_clv is not None else None,
        "clv_positive_rate": round(int(n_clv_pos or 0) / n_clv, 4) if n_clv else None,
        "n_clv": n_clv,
    }


def clv_vetoes_edge(record: Dict) -> Optional[str]:
    """Reason string when settled CLV evidence contradicts a validated edge, else None."""
    if record.get("n_clv", 0) >= CLV_GATE_MIN_N and (record.get("median_clv_90d") or 0) < 0:
        return (f"CLV veto: median realized CLV {record['median_clv_90d']:+.2%} over {record['n_clv']} "
                f"settled value bets — bets have not beaten the close")
    return None
