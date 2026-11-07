"""Per-sport market-anchored LightGBM with nested temporal CV, a market-baseline
honesty gate, and an automatic "should we retrain?" policy.

Model (2026-11-07): every game starts at logit(consensus home probability) via
LightGBM's init_score; the booster learns only a small, heavily regularised
correction on MODEL_FEATURE_NAMES. The number of correction rounds is chosen by
an inner temporal CV (0 = "the market is the model"). Backtest on 729 imported
games showed the previous unanchored model losing 0.01-0.03 log loss to the
market in every sport, while the anchored one stays at or near it.

Honesty gate: nested out-of-fold predictions (the rounds are chosen inside each
outer training fold, so the gate never grades its own selection) compared with
the de-vigged market probability on the same games, by log loss and Brier.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np
import pandas as pd

from .config import (ANCHOR_MIN_INNER_GAIN, ANCHOR_PARAMS, ANCHOR_ROUND_CANDIDATES, EDGE_GATE_MIN_LOGLOSS_GAIN,
                     EDGE_GATE_MIN_N,
                     MAX_MODEL_AGE_DAYS, MIN_NEW_GAMES, SPORTS, model_registry_id)
from .features import ALL_FEATURE_NAMES, FEATURES_VERSION, MODEL_FEATURE_NAMES
from . import model_store

logger = logging.getLogger(__name__)

MODEL_FILE, FEATURES_FILE, META_FILE = "lgbm_model.txt", "features.json", "metadata.json"
MODEL_KIND = "market_anchored_lgbm"
ANCHOR_FEATURE = "prob_home"
_EPS = 1e-4


def logit(p):
    p = np.clip(np.asarray(p, dtype=float), _EPS, 1 - _EPS)
    return np.log(p / (1 - p))


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.asarray(z, dtype=float)))


def model_dir_for(models_dir: str, sport_key: str) -> str:
    return os.path.join(models_dir, sport_key)


def load_metadata(models_dir: str, sport_key: str, conn=None) -> Optional[Dict]:
    """Newest model's metadata: database first (source of truth), files as fallback."""
    if conn is not None:
        stored = model_store.load_latest(conn, sport_key)
        if stored:
            return stored[2]
    path = os.path.join(model_dir_for(models_dir, sport_key), META_FILE)
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_training_frame(conn, sport_key: str) -> pd.DataFrame:
    with conn.cursor() as cur:
        cur.execute(
            """SELECT event_id, home_team, away_team, match_date, outcome, features,
                      consensus_home_prob, consensus_away_prob
                 FROM multisport_training
                WHERE sport_key = %s AND outcome IN ('H','A') AND features IS NOT NULL
                  AND features_version = %s
                ORDER BY match_date ASC, id ASC""",
            (sport_key, FEATURES_VERSION))
        rows = cur.fetchall()
    records = []
    for event_id, home, away, match_date, outcome, feats, cph, cpa in rows:
        if isinstance(feats, str):
            feats = json.loads(feats)
        rec = {"event_id": event_id, "home_team": home, "away_team": away, "match_date": match_date,
               "outcome": outcome, "label": 1 if outcome == "H" else 0,
               "consensus_home_prob": float(cph) if cph is not None else None}
        rec.update({k: float(feats.get(k, 0.0) or 0.0) for k in ALL_FEATURE_NAMES})
        records.append(rec)
    return pd.DataFrame(records)


def count_new_games(conn, sport_key: str, since: datetime) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM multisport_training WHERE sport_key = %s AND created_at > %s",
                    (sport_key, since))
        return int(cur.fetchone()[0])


def should_train(conn, sport_key: str, models_dir: str, now: Optional[datetime] = None) -> Tuple[bool, str]:
    """Policy: train if no model and enough rows; else retrain on >= MIN_NEW_GAMES
    new finished games, when the model is older than MAX_MODEL_AGE_DAYS, or when
    the stored model predates the market-anchored trainer."""
    now = now or datetime.now(timezone.utc)
    cfg = SPORTS[sport_key]
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM multisport_training WHERE sport_key = %s AND features IS NOT NULL",
                    (sport_key,))
        n = int(cur.fetchone()[0])
    meta = load_metadata(models_dir, sport_key, conn)
    if n < cfg.min_train_samples:
        return False, f"insufficient data: {n} < {cfg.min_train_samples}"
    if meta is None:
        return True, f"no model yet; {n} training rows available"
    if meta.get("model_kind") != MODEL_KIND:
        return True, "stored model predates the market-anchored trainer"
    trained_at = datetime.fromisoformat(meta["trained_at"])
    new_games = count_new_games(conn, sport_key, trained_at)
    if new_games >= MIN_NEW_GAMES:
        return True, f"{new_games} new finished games since last train"
    if now - trained_at > timedelta(days=MAX_MODEL_AGE_DAYS):
        return True, f"model is {(now - trained_at).days}d old"
    return False, f"model fresh ({(now - trained_at).days}d, {new_games} new games)"


def _logloss(y: np.ndarray, p: np.ndarray) -> float:
    p = np.clip(p, _EPS, 1 - _EPS)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def edge_gate(y: np.ndarray, oof: np.ndarray, market_home: np.ndarray, mask: np.ndarray) -> Dict:
    """Out-of-fold model vs the de-vigged market probability on the same games.
    Validated only with n >= EDGE_GATE_MIN_N, a log-loss gain >= EDGE_GATE_MIN_LOGLOSS_GAIN
    and a Brier score no worse than the market's. Accuracy vs the favorite is reported only."""
    y, oof, mkt = y[mask], oof[mask], market_home[mask]
    n = int(len(y))
    if n == 0:
        return {"n": 0, "edge_validated": False, "criterion": "logloss_vs_market",
                "validation": "no out-of-fold predictions"}
    ll_model, ll_market = _logloss(y, oof), _logloss(y, mkt)
    brier_model, brier_market = float(np.mean((oof - y) ** 2)), float(np.mean((mkt - y) ** 2))
    model_acc = float(np.mean((oof > 0.5).astype(int) == y))
    fav_acc = float(np.mean((mkt > 0.5).astype(int) == y))
    gain = ll_market - ll_model
    validated = n >= EDGE_GATE_MIN_N and gain >= EDGE_GATE_MIN_LOGLOSS_GAIN and brier_model <= brier_market
    head = f"log loss {ll_model:.4f} vs market {ll_market:.4f} ({gain:+.4f}, n={n})"
    if n < EDGE_GATE_MIN_N:
        text = f"INSUFFICIENT_SAMPLE n={n} (<{EDGE_GATE_MIN_N}); {head}"
    elif validated:
        text = f"temporal OOF {head} — beats the market"
    else:
        text = f"temporal OOF {head} — no demonstrated edge over the market"
    return {"n": n, "criterion": "logloss_vs_market",
            "model_logloss": round(ll_model, 4), "market_logloss": round(ll_market, 4),
            "logloss_gain": round(gain, 4),
            "brier_model": round(brier_model, 4), "brier_market": round(brier_market, 4),
            "model_acc": round(model_acc, 4), "favorite_acc": round(fav_acc, 4),
            "delta": round(model_acc - fav_acc, 4),
            "edge_validated": bool(validated), "validation": text}


class _Anchored:
    """Fits the correction booster once with the largest round budget and
    predicts at any smaller budget (num_iteration), so CV over the candidates is cheap."""

    def __init__(self, X: np.ndarray, y: np.ndarray, anchor_logit: np.ndarray):
        self.X, self.y, self.z0 = X, y, anchor_logit

    def fit(self, idx: np.ndarray, rounds: int):
        import lightgbm as lgb
        if rounds <= 0:
            return None
        ds = lgb.Dataset(self.X[idx], label=self.y[idx], init_score=self.z0[idx])
        return lgb.train(ANCHOR_PARAMS, ds, num_boost_round=rounds)

    def predict(self, booster, idx: np.ndarray, rounds: int) -> np.ndarray:
        z = self.z0[idx].copy()
        if booster is not None and rounds > 0:
            z += booster.predict(self.X[idx], raw_score=True, num_iteration=rounds)
        return sigmoid(z)

    def choose_rounds(self, idx: np.ndarray, candidates: Sequence[int],
                      min_gain: float = ANCHOR_MIN_INNER_GAIN) -> Tuple[int, Dict[int, float]]:
        """Inner temporal CV over a chronological prefix `idx`. A correction is kept only
        when it beats 0 rounds (the market) by >= min_gain log loss per validation game;
        among those, the lowest loss wins and ties go to fewer rounds."""
        from sklearn.model_selection import TimeSeriesSplit
        if len(idx) < 90:
            return 0, {}
        candidates = sorted(set(candidates) | {0})
        losses = {r: 0.0 for r in candidates}
        n_val = 0
        top = max(candidates)
        for tr, va in TimeSeriesSplit(n_splits=3).split(idx):
            tr_i, va_i = idx[tr], idx[va]
            booster = self.fit(tr_i, top)
            n_val += len(va_i)
            for r in candidates:
                losses[r] += _logloss(self.y[va_i], self.predict(booster, va_i, r)) * len(va_i)
        threshold = losses[0] - min_gain * n_val
        eligible = [r for r in candidates if r > 0 and losses[r] <= threshold]
        best = min(eligible, key=lambda r: (round(losses[r], 9), r)) if eligible else 0
        return int(best), {int(r): round(v, 4) for r, v in losses.items()}


def train_sport(conn, sport_key: str, models_dir: str, force: bool = False) -> Dict:
    from sklearn.model_selection import TimeSeriesSplit

    cfg = SPORTS[sport_key]
    ok, reason = should_train(conn, sport_key, models_dir)
    if not ok and not force:
        return {"status": "skipped", "reason": reason}

    df = load_training_frame(conn, sport_key)
    if len(df) < cfg.min_train_samples:
        return {"status": "insufficient_data", "n_samples": int(len(df)), "needed": cfg.min_train_samples}

    feature_names: List[str] = list(MODEL_FEATURE_NAMES)
    X = df[feature_names].fillna(0.0).to_numpy(dtype=float)
    y = df["label"].to_numpy(dtype=int)
    market = np.clip(df[ANCHOR_FEATURE].to_numpy(dtype=float), _EPS, 1 - _EPS)
    m = _Anchored(X, y, logit(market))
    candidates = tuple(sorted(set(ANCHOR_ROUND_CANDIDATES)))

    n_splits = min(5, max(3, len(df) // 60))
    oof = np.zeros(len(df))
    oof_mask = np.zeros(len(df), dtype=bool)
    fold_rounds = []
    for fold, (tr, va) in enumerate(TimeSeriesSplit(n_splits=n_splits).split(X), 1):
        r, _ = m.choose_rounds(tr, candidates)          # selection sees only this fold's past
        oof[va], oof_mask[va] = m.predict(m.fit(tr, r), va, r), True
        fold_rounds.append(r)
        logger.info("%s fold %d/%d rounds=%d logloss=%.4f (market %.4f)", cfg.name, fold, n_splits, r,
                    _logloss(y[va], oof[va]), _logloss(y[va], market[va]))

    final_rounds, inner_losses = m.choose_rounds(np.arange(len(df)), candidates)
    final = m.fit(np.arange(len(df)), final_rounds)
    gate = edge_gate(y, oof, market, oof_mask)
    model_text = final.model_to_string() if final is not None else None
    importance = (sorted(zip(feature_names, final.feature_importance(importance_type="gain")), key=lambda t: -t[1])
                  if final is not None else [])

    metadata = {
        "model_id": model_registry_id(sport_key),
        "model_type": "V3_Multisport_LightGBM",
        "model_kind": MODEL_KIND,
        "anchor_feature": ANCHOR_FEATURE,
        "anchor_rounds": int(final_rounds),
        "fold_rounds": fold_rounds,
        "inner_cv_logloss_sum": inner_losses,
        "sport_key": sport_key,
        "features_version": FEATURES_VERSION,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "train_reason": reason if ok else "forced",
        "n_samples": int(len(df)),
        # provenance: games imported from CSV (single closing snapshot, no line movement)
        "n_samples_from_csv": int(df["event_id"].astype(str).str.startswith("csv-").sum()),
        "date_range": [str(df["match_date"].min()), str(df["match_date"].max())],
        "n_folds": n_splits,
        "oof_metrics": {"accuracy": gate.get("model_acc"), "logloss": gate.get("model_logloss"),
                        "brier": gate.get("brier_model"), "market_logloss": gate.get("market_logloss")},
        "edge_gate": gate,
        "feature_importance": [{"feature": f, "importance": float(i)} for f, i in importance],
    }

    out_dir = model_dir_for(models_dir, sport_key)
    os.makedirs(out_dir, exist_ok=True)
    model_path = os.path.join(out_dir, MODEL_FILE)
    if model_text is not None:
        with open(model_path, "w", encoding="utf-8") as f:
            f.write(model_text)
    elif os.path.exists(model_path):
        os.remove(model_path)                            # market-only: no booster to load
    with open(os.path.join(out_dir, FEATURES_FILE), "w", encoding="utf-8") as f:
        json.dump(feature_names, f, indent=2)
    with open(os.path.join(out_dir, META_FILE), "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    model_store.save_model(conn, sport_key, model_text, feature_names, metadata)

    logger.info("%s: trained on %d games; anchor rounds %d; gate: %s", cfg.name, len(df),
                final_rounds, gate["validation"])
    return {"status": "ok", "sport_key": sport_key, "n_samples": int(len(df)), "anchor_rounds": int(final_rounds),
            "oof_metrics": metadata["oof_metrics"], "edge_gate": gate, "model_dir": out_dir}
