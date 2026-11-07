import numpy as np

from snapbet_pipeline.config import EDGE_GATE_MIN_N
from snapbet_pipeline.train import edge_gate


def _case(n, model_right_rate, fav_right_rate, seed=0):
    rng = np.random.default_rng(seed)
    y = rng.integers(0, 2, size=n)
    oof = np.where(rng.random(n) < model_right_rate, np.where(y == 1, 0.8, 0.2), np.where(y == 1, 0.2, 0.8))
    fav = np.where(rng.random(n) < fav_right_rate, y == 1, y == 0)
    return y, oof, fav, np.ones(n, dtype=bool)


def test_gate_insufficient_sample():
    g = edge_gate(*_case(EDGE_GATE_MIN_N - 1, 0.9, 0.5))
    assert g["edge_validated"] is False and "INSUFFICIENT_SAMPLE" in g["validation"]


def test_gate_validated_when_beating_favorite():
    g = edge_gate(*_case(400, 0.70, 0.55))
    assert g["edge_validated"] is True and g["delta"] >= 0.02 and g["n"] == 400


def test_gate_not_validated_when_matching_market():
    g = edge_gate(*_case(400, 0.55, 0.55))
    assert g["edge_validated"] is False and "no demonstrated edge" in g["validation"]


def test_gate_respects_mask():
    y, oof, fav, mask = _case(200, 0.9, 0.5)
    mask[:150] = False
    assert edge_gate(y, oof, fav, mask)["n"] == 50
