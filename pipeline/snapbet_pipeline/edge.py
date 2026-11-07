"""2-way edge math — port of BetGeniusAI utils/edge.py restricted to home/away.

Produces the `market` / `value` / `clv` / `model_track_record` blocks the
frontend reads via lib/edge/extract.ts. Contract (docs/MULTISPORT_EDGE_BACKEND_REQUIREMENTS.md):
  * market.implied sums to 1.0 ±0.001 over {home, away}; no `draw` key anywhere
  * value.value_bet is None unless the model's gate passed (edge_validated), the model
    beats the de-vigged consensus by VALUE_MIN_EDGE, and EV > 0 at the consensus price
  * kelly_quarter == kelly_full / 4, both >= 0
  * edge_validated comes from the trained model's holdout gate, never hardcoded true
"""
from __future__ import annotations

from typing import Dict, Optional

from .config import RATING_TIERS, VALUE_MIN_EDGE

OUTCOMES = ("home", "away")
CANONICAL_BET = {"home": "home_win", "away": "away_win"}


def devig(raw: Dict[str, float]) -> Dict[str, float]:
    vals = {}
    for k in OUTCOMES:
        v = raw.get(k)
        if v is None or v <= 0:
            raise ValueError(f"missing/invalid raw probability for {k}: {v}")
        vals[k] = float(v)
    total = sum(vals.values())
    return {k: vals[k] / total for k in OUTCOMES}


def ev_at_price(p: float, odds: float) -> float:
    return p * odds - 1.0


def min_acceptable_odds(p: float) -> float:
    return round(1.0 / p, 3) if p > 0 else float("inf")


def kelly(p: float, odds: float) -> float:
    if odds <= 1.0:
        return 0.0
    return max(0.0, round((p * odds - 1.0) / (odds - 1.0), 4))


def rating(ev: Optional[float]) -> str:
    if ev is None or ev <= 0:
        return "no_value"
    for threshold, name in RATING_TIERS:
        if ev >= threshold:
            return name
    return "no_value"


def select_value_bet(model_probs: Dict[str, float], best_prices: Dict[str, Dict],
                     fair: Optional[Dict[str, float]] = None,
                     consensus_odds: Optional[Dict[str, Optional[float]]] = None,
                     min_edge: float = VALUE_MIN_EDGE) -> Optional[Dict]:
    """Value bet = the side where the model beats the de-vigged consensus by >= min_edge
    AND has positive EV at the consensus price. The best single-book price is then
    reported as where to take it (EV/Kelly at that price). Without `fair` and
    `consensus_odds` (legacy callers) it falls back to EV > 0 at the best price."""
    best = None
    for k in OUTCOMES:
        entry = best_prices.get(k) or {}
        odds = entry.get("odds")
        if not odds or odds <= 1.0:
            continue
        ev = ev_at_price(model_probs[k], odds)
        if fair is not None and consensus_odds is not None:
            c_odds = consensus_odds.get(k)
            if not c_odds or c_odds <= 1.0:
                continue
            ev_cons = ev_at_price(model_probs[k], c_odds)
            if model_probs[k] - fair[k] < min_edge or ev_cons <= 0:
                continue
        else:
            ev_cons = None
        if ev > 0 and (best is None or ev > best["ev"]):
            kf = kelly(model_probs[k], odds)
            best = {"outcome": k, "bet": CANONICAL_BET[k], "ev": round(ev, 4), "price": odds,
                    "book": entry.get("book"), "min_acceptable_odds": min_acceptable_odds(model_probs[k]),
                    "kelly_full": kf, "kelly_quarter": round(kf / 4.0, 4)}
            if ev_cons is not None:
                best["ev_at_consensus"] = round(ev_cons, 4)
    return best


def build_value_payload(model_probs: Optional[Dict[str, float]], market_raw: Optional[Dict[str, float]],
                        best_prices: Optional[Dict[str, Dict]], n_books: Optional[int],
                        consensus_odds: Optional[Dict[str, Optional[float]]] = None,
                        edge_validated: bool = False) -> Dict:
    """market/value/clv blocks. Any missing input degrades to None, never a fake edge.
    value.value_bet is None unless the model's honesty gate passed (edge_validated):
    an unvalidated model's disagreement with the market is noise, not value."""
    market_block = value_block = None
    fair = None
    if market_raw:
        try:
            fair = devig(market_raw)
            market_block = {
                "implied": {k: round(fair[k], 4) for k in OUTCOMES},
                "overround": round(sum(float(market_raw.get(k) or 0.0) for k in OUTCOMES), 4),
                "n_books": n_books,
                "best_price": best_prices or None,
            }
        except ValueError:
            fair = None
    if fair and model_probs:
        edge = {k: round(model_probs[k] - fair[k], 4) for k in OUTCOMES}
        ev_best: Dict[str, Optional[float]] = {}
        if best_prices:
            for k in OUTCOMES:
                odds = (best_prices.get(k) or {}).get("odds")
                ev_best[k] = round(ev_at_price(model_probs[k], odds), 4) if odds and odds > 1.0 else None
        vb = (select_value_bet(model_probs, best_prices, fair=fair, consensus_odds=consensus_odds or {})
              if (best_prices and edge_validated) else None)
        top_ev = vb["ev"] if vb else None
        value_block = {"edge": edge, "ev_at_best": ev_best or None, "value_bet": vb, "rating": rating(top_ev),
                       "gated": None if edge_validated else "model edge not validated; no value bets",
                       "min_acceptable_odds": {k: min_acceptable_odds(model_probs[k]) for k in OUTCOMES}}
    clv_block = {"bet_time_odds": (value_block or {}).get("value_bet", {}).get("price")
                 if value_block and value_block.get("value_bet") else None,
                 "closing_odds": None, "realized_clv": None}
    return {"market": market_block, "value": value_block, "clv": clv_block}


def model_track_record(model_id: str, gate: Optional[Dict], record: Optional[Dict] = None,
                       clv_veto: Optional[str] = None) -> Dict:
    """Honesty block.
    gate   : metadata['edge_gate'] from the trained model (or None)
    record : ledger.track_record() output for the sport (or None)
    clv_veto: reason string when settled CLV contradicts the gate (ledger.clv_vetoes_edge)
    """
    gate = gate or {}
    record = record or {}
    validated = bool(gate.get("edge_validated", False))
    validation = gate.get("validation", "no trained model / not validated")
    if validated and clv_veto:
        validated = False
        validation = f"{validation}; {clv_veto}"
    return {
        "model": model_id,
        "segment": "efficient_market",
        "edge_validated": validated,
        "validation": validation,
        "median_clv_90d": record.get("median_clv_90d"),
        "n_settled": record.get("n_settled") if record else gate.get("n"),
        "track_record": {k: record.get(k) for k in ("window_days", "pick_hit_rate", "n_value_bets",
                                                      "value_bet_hit_rate", "value_bet_roi_1u",
                                                      "clv_positive_rate", "n_clv")} if record else None,
    }
