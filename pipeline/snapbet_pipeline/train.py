"""Per-sport LightGBM training with temporal CV, a favorite-baseline holdout gate,
and an automatic "should we retrain?" policy.

Port of BetGeniusAI training/train_multisport_v3.py with three changes:
  * features come from multisport_training.features (built leak-safe by training_sync)
  * best_iteration is averaged over folds (the original used the last fold only)
  * the honesty gate is computed here: out-of-fold model accuracy vs "pick the
    consensus favorite". metadata.edge_gate.edge_validated feeds model_track_record.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Tuple

import numpy as np
import pandas as pd

from .config import (EARLY_STOPPING, EDGE_GATE_MIN_DELTA, EDGE_GATE_MIN_N, LGBM_PARAMS,
                     MAX_MODEL_AGE_DAYS, MIN_NEW_GAMES, N_ESTIMATORS, SPORTS, model_registry_id)
from .features import ALL_FEATURE_NAMES, FEATURES_VERSION

logger = logging.getLogger(__name__)

MODEL_FILE, FEATURES_FILE, META_FILE = "lgbm_model.txt", "features.json", "metadata.json"


def model_dir_for(models_dir: str, sport_key: str) -> str:
    return os.path.join(models_dir, sport_key)


def load_metadata(models_dir: str, sport_key: str) -> Optional[Dict]:
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
    new finished games or when the model is older than MAX_MODEL_AGE_DAYS."""
    now = now or datetime.now(timezone.utc)
    cfg = SPORTS[sport_key]
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM multisport_training WHERE sport_key = %s AND features IS NOT NULL",
                    (sport_key,))
        n = int(cur.fetchone()[0])
    meta = load_metadata(models_dir, sport_key)
    if n < cfg.min_train_samples:
        return False, f"insufficient data: {n} < {cfg.min_train_samples}"
    if meta is None:
        return True, f"no model yet; {n} training rows available"
    trained_at = datetime.fromisoformat(meta["trained_at"])
    new_games = count_new_games(conn, sport_key, trained_at)
    if new_games >= MIN_NEW_GAMES:
        return True, f"{new_games} new finished games since last train"
    if now - trained_at > timedelta(days=MAX_MODEL_AGE_DAYS):
        return True, f"model is {(now - trained_at).days}d old"
    return False, f"model fresh ({(now - trained_at).days}d, {new_games} new games)"


def edge_gate(y: np.ndarray, oof: np.ndarray, fav_home: np.ndarray, mask: np.ndarray) -> Dict:
    """Out-of-fold model vs consensus-favorite baseline. Only rows that were
    predicted out-of-fold (mask) count."""
    y, oof, fav = y[mask], oof[mask], fav_home[mask]
    n = int(len(y))
    if n == 0:
        return {"n": 0, "edge_validated": False, "validation": "no out-of-fold predictions"}
    model_acc = float(np.mean((oof > 0.5).astype(int) == y))
    fav_acc = float(np.mean(fav.astype(int) == y))
    brier_model = float(np.mean((oof - y) ** 2))
    delta = model_acc - fav_acc
    validated = n >= EDGE_GATE_MIN_N and delta >= EDGE_GATE_MIN_DELTA
    if n < EDGE_GATE_MIN_N:
        text = f"INSUFFICIENT_SAMPLE n={n} (<{EDGE_GATE_MIN_N}); model {model_acc:.1%} vs favorite {fav_acc:.1%}"
    elif validated:
        text = f"temporal OOF {model_acc:.1%} vs favorite {fav_acc:.1%} (+{delta*100:.1f}pp, n={n})"
    else:
        text = f"temporal OOF {model_acc:.1%} vs favorite {fav_acc:.1%} ({delta*100:+.1f}pp, n={n}) — no demonstrated edge"
    return {"n": n, "model_acc": round(model_acc, 4), "favorite_acc": round(fav_acc, 4),
            "delta": round(delta, 4), "brier_model": round(brier_model, 4),
            "edge_validated": bool(validated), "validation": text}


def train_sport(conn, sport_key: str, models_dir: str, force: bool = False) -> Dict:
    import lightgbm as lgb
    from sklearn.metrics import accuracy_score, log_loss
    from sklearn.model_selection import TimeSeriesSplit

    cfg = SPORTS[sport_key]
    ok, reason = should_train(conn, sport_key, models_dir)
    if not ok and not force:
        return {"status": "skipped", "reason": reason}

    df = load_training_frame(conn, sport_key)
    if len(df) < cfg.min_train_samples:
        return {"status": "insufficient_data", "n_samples": int(len(df)), "needed": cfg.min_train_samples}

    X = df[ALL_FEATURE_NAMES].fillna(0.0).to_numpy(dtype=float)
    y = df["label"].to_numpy(dtype=int)
    fav_home = (df["prob_home"].to_numpy(dtype=float) > 0.5)

    n_splits = min(5, max(3, len(df) // 60))
    tscv = TimeSeriesSplit(n_splits=n_splits)
    oof = np.zeros(len(df))
    oof_mask = np.zeros(len(df), dtype=bool)
    fold_acc, fold_loss, best_iters = [], [], []
    for fold, (tr, va) in enumerate(tscv.split(X), 1):
        dtrain = lgb.Dataset(X[tr], label=y[tr])
        dval = lgb.Dataset(X[va], label=y[va], reference=dtrain)
        model = lgb.train(LGBM_PARAMS, dtrain, num_boost_round=N_ESTIMATORS, valid_sets=[dval],
                          callbacks=[lgb.early_stopping(EARLY_STOPPING, verbose=False), lgb.log_evaluation(0)])
        p = model.predict(X[va], num_iteration=model.best_iteration)
        oof[va], oof_mask[va] = p, True
        fold_acc.append(accuracy_score(y[va], (p > 0.5).astype(int)))
        fold_loss.append(log_loss(y[va], np.clip(p, 1e-6, 1 - 1e-6), labels=[0, 1]))
        best_iters.append(max(model.best_iteration or 1, 1))
        logger.info("%s fold %d/%d acc=%.3f logloss=%.3f iters=%d", cfg.name, fold, n_splits,
                    fold_acc[-1], fold_loss[-1], best_iters[-1])

    final_rounds = max(int(np.mean(best_iters) * 1.1), 50)
    final = lgb.train(LGBM_PARAMS, lgb.Dataset(X, label=y), num_boost_round=final_rounds,
                      callbacks=[lgb.log_evaluation(0)])

    gate = edge_gate(y, oof, fav_home, oof_mask)
    importance = sorted(zip(ALL_FEATURE_NAMES, final.feature_importance(importance_type="gain")),
                        key=lambda t: -t[1])
    out_dir = model_dir_for(models_dir, sport_key)
    os.makedirs(out_dir, exist_ok=True)
    final.save_model(os.path.join(out_dir, MODEL_FILE))
    with open(os.path.join(out_dir, FEATURES_FILE), "w", encoding="utf-8") as f:
        json.dump(ALL_FEATURE_NAMES, f, indent=2)
    metadata = {
        "model_id": model_registry_id(sport_key),
        "model_type": "V3_Multisport_LightGBM",
        "sport_key": sport_key,
        "features_version": FEATURES_VERSION,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "train_reason": reason if ok else "forced",
        "n_samples": int(len(df)),
        # provenance: games imported from CSV (single closing snapshot, no line movement)
        "n_samples_from_csv": int(df["event_id"].astype(str).str.startswith("csv-").sum()),
        "date_range": [str(df["match_date"].min()), str(df["match_date"].max())],
        "n_folds": n_splits,
        "final_rounds": final_rounds,
        "oof_metrics": {"accuracy": round(float(np.mean(fold_acc)), 4),
                        "logloss": round(float(np.mean(fold_loss)), 4)},
        "edge_gate": gate,
        "feature_importance": [{"feature": f, "importance": float(i)} for f, i in importance[:46]],
    }
    with open(os.path.join(out_dir, META_FILE), "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    logger.info("%s: trained on %d games; OOF acc %.3f; gate: %s", cfg.name, len(df),
                metadata["oof_metrics"]["accuracy"], gate["validation"])
    return {"status": "ok", "sport_key": sport_key, "n_samples": int(len(df)),
            "oof_metrics": metadata["oof_metrics"], "edge_gate": gate, "model_dir": out_dir}
