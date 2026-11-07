import numpy as np
import pytest

from snapbet_pipeline.config import EDGE_GATE_MIN_N
from snapbet_pipeline.train import _Anchored, edge_gate, logit, sigmoid


def _games(n, seed=0):
    """True home-win probabilities, a market that knows them, and outcomes."""
    rng = np.random.default_rng(seed)
    p_true = rng.uniform(0.25, 0.75, size=n)
    y = (rng.random(n) < p_true).astype(int)
    return p_true, y


def test_gate_insufficient_sample():
    p, y = _games(EDGE_GATE_MIN_N - 1)
    g = edge_gate(y, p, np.full_like(p, 0.5), np.ones(len(y), bool))
    assert g["edge_validated"] is False and "INSUFFICIENT_SAMPLE" in g["validation"]


def test_gate_validated_when_beating_market_logloss():
    p, y = _games(2000)
    market = np.clip(p + np.random.default_rng(1).normal(0, 0.12, len(p)), 0.05, 0.95)   # noisy market
    g = edge_gate(y, p, market, np.ones(len(y), bool))
    assert g["edge_validated"] is True and g["logloss_gain"] >= 0.005 and g["n"] == 2000
    assert g["criterion"] == "logloss_vs_market" and g["brier_model"] <= g["brier_market"]


def test_gate_not_validated_when_equal_to_market():
    p, y = _games(2000)
    g = edge_gate(y, p, p, np.ones(len(y), bool))
    assert g["edge_validated"] is False and g["logloss_gain"] == 0 and "no demonstrated edge" in g["validation"]


def test_gate_ignores_accuracy_when_probabilities_are_worse():
    # same picks as the market but overconfident: accuracy ties, log loss loses
    p, y = _games(2000)
    overconfident = np.where(p > 0.5, 0.97, 0.03)
    g = edge_gate(y, overconfident, p, np.ones(len(y), bool))
    assert g["delta"] == 0 and g["edge_validated"] is False and g["logloss_gain"] < 0


def test_gate_respects_mask():
    p, y = _games(200)
    mask = np.ones(200, bool)
    mask[:150] = False
    assert edge_gate(y, p, p, mask)["n"] == 50


def test_anchored_picks_zero_rounds_when_market_is_right():
    p, y = _games(600, seed=3)
    X = np.random.default_rng(4).normal(size=(600, 5))          # pure-noise features
    m = _Anchored(X, y, logit(p))
    rounds, _ = m.choose_rounds(np.arange(600), (0, 10, 50, 200))
    assert rounds <= 10                                          # no real signal beyond the market
    assert np.allclose(m.predict(None, np.arange(5), 0), p[:5])  # 0 rounds == the market


def test_anchored_learns_signal_the_market_misses():
    rng = np.random.default_rng(5)
    n = 3000
    market = rng.uniform(0.3, 0.7, size=n)
    x = rng.normal(size=n)
    p_true = sigmoid(logit(market) + 0.8 * x)                   # feature x moves the true probability
    y = (rng.random(n) < p_true).astype(int)
    X = np.column_stack([x, rng.normal(size=n)])
    m = _Anchored(X, y, logit(market))
    rounds, losses = m.choose_rounds(np.arange(n), (0, 25, 100, 200))
    assert rounds > 0 and losses[rounds] < losses[0]


def test_predictor_anchored_without_booster_returns_market():
    from snapbet_pipeline.predict import Predictor
    pr = Predictor("basketball_nba", None, ["prob_home"], {"model_kind": "market_anchored_lgbm"})
    assert pr.predict_proba_home({"prob_home": 0.63}) == pytest.approx(0.63, abs=1e-6)
    assert pr.edge_validated is False and pr.is_market_only is True
