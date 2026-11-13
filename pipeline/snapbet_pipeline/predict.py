"""Batch inference for upcoming fixtures.

For every scheduled fixture with a consensus line we produce a `Prediction`
record that publish.py writes into the frontend's MultisportMatch table.
When no trained model exists for the sport (cold start) the record still
carries the market data but `model` is None — the UI then shows the market
panel and no model pick, which is the honest state.
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import numpy as np

from .config import SPORTS, model_registry_id
from .consensus import best_prices
from .edge import build_value_payload, model_track_record
from .features import ALL_FEATURE_NAMES, MultisportFeatureBuilder
from .ledger import clv_vetoes_edge, track_record
from . import model_store
from .train import ANCHOR_FEATURE, FEATURES_FILE, META_FILE, MODEL_FILE, MODEL_KIND, logit, model_dir_for, sigmoid

logger = logging.getLogger(__name__)

PREDICT_HORIZON_DAYS = 8   # NFL games are weekly; predict the whole upcoming slate


class Predictor:
    """A trained model. Market-anchored models predict sigmoid(logit(market) + correction);
    with no booster (0 correction rounds) that is exactly the market. Legacy unanchored
    models (no model_kind in metadata) predict the booster's probability directly."""

    def __init__(self, sport_key: str, model_text: Optional[str], feature_names: List[str], metadata: Dict):
        import lightgbm as lgb
        self.sport_key = sport_key
        self.model = lgb.Booster(model_str=model_text) if model_text else None
        self.feature_names = list(feature_names)
        self.metadata = dict(metadata)
        self.anchored = self.metadata.get("model_kind") == MODEL_KIND
        if self.model is None and not self.anchored:
            raise ValueError("legacy model without a booster")

    @classmethod
    def from_dir(cls, sport_key: str, model_dir: str) -> "Predictor":
        with open(os.path.join(model_dir, FEATURES_FILE), "r", encoding="utf-8") as f:
            feature_names = json.load(f)
        with open(os.path.join(model_dir, META_FILE), "r", encoding="utf-8") as f:
            metadata = json.load(f)
        text = None
        if os.path.exists(os.path.join(model_dir, MODEL_FILE)):
            with open(os.path.join(model_dir, MODEL_FILE), "r", encoding="utf-8") as f:
                text = f.read()
        return cls(sport_key, text, feature_names, metadata)

    @classmethod
    def load(cls, models_dir: str, sport_key: str, conn=None) -> Optional["Predictor"]:
        """Newest model from the database when a connection is given, else from files."""
        try:
            if conn is not None:
                stored = model_store.load_latest(conn, sport_key)
                if stored:
                    return cls(sport_key, *stored)
            d = model_dir_for(models_dir, sport_key)
            if not os.path.exists(os.path.join(d, META_FILE)):
                return None
            return cls.from_dir(sport_key, d)
        except Exception as e:
            logger.error("could not load model for %s: %s", sport_key, e)
            return None

    def predict_proba_home(self, feats: Dict[str, float]) -> float:
        x = np.array([[float(feats.get(f, 0.0)) for f in self.feature_names]], dtype=float)
        if self.anchored:
            z = float(logit(feats.get(ANCHOR_FEATURE) or 0.5))
            if self.model is not None:
                z += float(self.model.predict(x, raw_score=True)[0])
            p = float(sigmoid(z))
        else:
            p = float(self.model.predict(x)[0])
        return min(max(p, 0.01), 0.99)

    @property
    def is_market_only(self) -> bool:
        """The trainer chose 0 correction rounds: the 'model' is the market itself.
        Published like cold start (no model pick) so the market is never relabelled
        as a model call; model_info / track record still say why."""
        return self.anchored and self.model is None

    @property
    def edge_validated(self) -> bool:
        return bool((self.metadata.get("edge_gate") or {}).get("edge_validated", False))

    def info(self) -> Dict:
        m = self.metadata
        return {"name": m.get("model_id"), "version": m.get("model_type"), "kind": m.get("model_kind"),
                "anchor_rounds": m.get("anchor_rounds"), "trained_at": m.get("trained_at"),
                "n_samples": m.get("n_samples"), "accuracy": (m.get("oof_metrics") or {}).get("accuracy"),
                "logloss": (m.get("oof_metrics") or {}).get("logloss"), "n_features": len(self.feature_names),
                "edge_gate": m.get("edge_gate"),
                "top_features": [fi["feature"] for fi in (m.get("feature_importance") or [])[:10]]}


@dataclass
class Prediction:
    sport_key: str
    event_id: str
    home_team: str
    away_team: str
    league: str
    commence_time: datetime
    consensus: Optional[Dict]              # latest consensus snapshot as dict
    books: Dict[str, Dict]                 # latest per-book quotes
    model_block: Optional[Dict]            # MultisportMatch.model (None on cold start)
    prediction_data: Dict                  # MultisportMatch.predictionData
    generated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


def conviction_tier(confidence: float) -> str:
    # Plain thresholds on calibrated probability. The accuracy-era spread floors
    # (88% at spread>10 etc.) were deliberately NOT ported (MULTISPORT_EDGE_PLAN D4).
    if confidence >= 0.75:
        return "premium"
    if confidence >= 0.62:
        return "strong"
    return "standard"


def _latest_consensus(cur, sport_key: str, event_id: str) -> Optional[Dict]:
    cur.execute(
        """SELECT home_odds, away_odds, home_prob, away_prob, home_spread, home_spread_odds, away_spread_odds,
                  total_line, over_odds, under_odds, overround, n_bookmakers, ts_recorded
             FROM multisport_odds_snapshots
            WHERE sport_key = %s AND event_id = %s AND is_consensus
            ORDER BY ts_recorded DESC LIMIT 1""", (sport_key, event_id))
    r = cur.fetchone()
    if not r:
        return None
    keys = ["home_odds", "away_odds", "home_prob", "away_prob", "home_spread", "home_spread_odds",
            "away_spread_odds", "total_line", "over_odds", "under_odds", "overround", "n_bookmakers", "ts_recorded"]
    d = dict(zip(keys, r))
    for k, v in d.items():
        if k != "ts_recorded" and v is not None:
            d[k] = float(v) if k != "n_bookmakers" else int(v)
    d["ts_recorded"] = d["ts_recorded"].isoformat() if d["ts_recorded"] else None
    return d


def _latest_books(cur, sport_key: str, event_id: str) -> Dict[str, Dict]:
    cur.execute(
        """SELECT DISTINCT ON (bookmaker) bookmaker, home_odds, away_odds, home_spread, total_line, ts_recorded
             FROM multisport_odds_snapshots
            WHERE sport_key = %s AND event_id = %s AND NOT is_consensus
            ORDER BY bookmaker, ts_recorded DESC""", (sport_key, event_id))
    books = {}
    cutoff = None
    rows = cur.fetchall()
    if rows:
        newest = max(r[5] for r in rows)
        cutoff = newest - timedelta(hours=6)  # drop books that stopped quoting
    for bk, ho, ao, sp, tl, ts in rows:
        if cutoff and ts < cutoff:
            continue
        books[bk] = {"home_odds": float(ho) if ho else None, "away_odds": float(ao) if ao else None,
                     "spread": float(sp) if sp is not None else None, "total": float(tl) if tl is not None else None}
    return books


def predict_upcoming(conn, sport_key: str, predictor: Optional[Predictor], now: Optional[datetime] = None,
                     horizon_days: int = PREDICT_HORIZON_DAYS) -> List[Prediction]:
    now = now or datetime.now(timezone.utc)
    cfg = SPORTS[sport_key]
    builder = MultisportFeatureBuilder(conn)
    record = track_record(conn, sport_key, now=now)        # settled evidence from the pick ledger
    veto = clv_vetoes_edge(record)
    with conn.cursor() as cur:
        cur.execute(
            """SELECT event_id, home_team, away_team, league_name, commence_time
                 FROM multisport_fixtures
                WHERE sport_key = %s AND status <> 'finished' AND commence_time > %s AND commence_time <= %s
                ORDER BY commence_time ASC""",
            (sport_key, now, now + timedelta(days=horizon_days)))
        fixtures = cur.fetchall()

        out: List[Prediction] = []
        for event_id, home, away, league, commence in fixtures:
            cons = _latest_consensus(cur, sport_key, event_id)
            if not cons:
                continue  # nothing to price against yet
            books = _latest_books(cur, sport_key, event_id)
            bp = best_prices({k: {"home_odds": v["home_odds"], "away_odds": v["away_odds"]} for k, v in books.items()})
            market_raw = {"home": cons["home_prob"], "away": cons["away_prob"]} if cons.get("home_prob") else None

            model_block = None
            model_probs = None
            feature_values: Dict[str, float] = {}
            if predictor is not None and not predictor.is_market_only:
                feature_values = builder.build_features(sport_key, event_id, home, away, commence, cutoff_dt=now)
                p_home = predictor.predict_proba_home(feature_values)
                p_away = 1.0 - p_home
                pick = "H" if p_home >= 0.5 else "A"
                conf = max(p_home, p_away)
                model_probs = {"home": p_home, "away": p_away}
                p_market_pick = (market_raw["home"] if pick == "H" else market_raw["away"]) if market_raw else None
                model_block = {
                    "predictions": {
                        "home_win": round(p_home, 4), "away_win": round(p_away, 4), "pick": pick,
                        "confidence": round(conf, 4), "conviction_tier": conviction_tier(conf),
                        "edge_vs_market": round(conf - p_market_pick, 4) if p_market_pick is not None else None,
                    },
                    "source": "v3_multisport", "no_draw": True,
                    "model_id": predictor.metadata.get("model_id"),
                    "trained_at": predictor.metadata.get("trained_at"),
                }

            track = model_track_record(model_registry_id(sport_key),
                                       predictor.metadata.get("edge_gate") if predictor else None,
                                       record=record, clv_veto=veto)
            consensus_odds = {"home": cons.get("home_odds"), "away": cons.get("away_odds")}
            edge_blocks = build_value_payload(model_probs, market_raw, bp, cons.get("n_bookmakers"),
                                              consensus_odds=consensus_odds,
                                              edge_validated=bool(track.get("edge_validated")))
            prediction_data = {
                "source": "snapbet_pipeline",
                "generated_at": now.isoformat(),
                "match_info": {"event_id": event_id, "sport": sport_key, "home_team": home, "away_team": away,
                               "league_name": league or cfg.league_name, "commence_time": commence.isoformat()},
                "predictions": (model_block or {}).get("predictions"),
                "odds": cons,
                "books": books,
                "model_info": predictor.info() if predictor else None,
                "feature_values": {k: round(v, 4) for k, v in feature_values.items()} if feature_values else None,
                "markets": _markets(cons, model_probs, home, away),
                **edge_blocks,
                "model_track_record": track,
            }
            out.append(Prediction(sport_key, event_id, home, away, league or cfg.league_name, commence,
                                  cons, books, model_block, prediction_data, now))
    return out


def _markets(cons: Dict, model_probs: Optional[Dict[str, float]], home: str = "Home",
             away: str = "Away") -> List[Dict]:
    """Market summaries in the structured shape the match page renders:
    {market, options: [{label, model_prob, implied_prob, decimal_odds, edge}]}.
    Spread/total carry no model probability (the model is moneyline-only)."""
    rows: List[Dict] = []

    def opt(label, implied, odds, model_p=None):
        edge = round(model_p - implied, 4) if (model_p is not None and implied is not None) else None
        return {"label": label, "model_prob": model_p, "implied_prob": implied, "decimal_odds": odds, "edge": edge}

    if cons.get("home_odds") and cons.get("away_odds"):
        rows.append({"market": "Moneyline", "options": [
            opt(home, cons.get("home_prob"), cons["home_odds"], round(model_probs["home"], 4) if model_probs else None),
            opt(away, cons.get("away_prob"), cons["away_odds"], round(model_probs["away"], 4) if model_probs else None),
        ]})
    if cons.get("home_spread") is not None:
        s = cons["home_spread"]
        rows.append({"market": "Spread", "options": [
            opt(f"{home} {s:+g}", None, cons.get("home_spread_odds")),
            opt(f"{away} {-s:+g}", None, cons.get("away_spread_odds")),
        ]})
    if cons.get("total_line") is not None:
        t = cons["total_line"]
        rows.append({"market": "Total", "options": [
            opt(f"Over {t:g}", None, cons.get("over_odds")),
            opt(f"Under {t:g}", None, cons.get("under_odds")),
        ]})
    return rows
