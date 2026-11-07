"""Contract tests mirroring docs/MULTISPORT_EDGE_BACKEND_REQUIREMENTS.md 'Hard requirements'."""
import pytest

from snapbet_pipeline.edge import build_value_payload, devig, kelly, model_track_record, rating, select_value_bet


def test_devig_sums_to_one_no_draw():
    fair = devig({"home": 0.55, "away": 0.50})
    assert abs(sum(fair.values()) - 1.0) < 1e-9
    assert set(fair) == {"home", "away"}


def test_devig_rejects_missing_side():
    with pytest.raises(ValueError):
        devig({"home": 0.6})


def test_value_bet_none_when_no_positive_ev():
    model = {"home": 0.50, "away": 0.50}
    prices = {"home": {"odds": 1.90, "book": "dk"}, "away": {"odds": 1.95, "book": "fd"}}
    assert select_value_bet(model, prices) is None


def test_value_bet_is_argmax_ev_and_kelly_quarter():
    model = {"home": 0.60, "away": 0.40}
    prices = {"home": {"odds": 1.95, "book": "dk"}, "away": {"odds": 2.40, "book": "fd"}}
    vb = select_value_bet(model, prices)
    assert vb["bet"] == "home_win" and vb["outcome"] == "home"
    assert vb["ev"] == pytest.approx(0.6 * 1.95 - 1, abs=1e-4)
    assert vb["ev"] > 0
    assert vb["kelly_quarter"] == pytest.approx(vb["kelly_full"] / 4, abs=1e-4)
    assert vb["kelly_full"] >= 0
    assert vb["min_acceptable_odds"] == pytest.approx(1 / 0.6, abs=1e-3)


def test_payload_market_block_contract():
    model = {"home": 0.58, "away": 0.42}
    raw = {"home": 0.56, "away": 0.48}          # raw implied incl. vig (sums 1.04)
    bp = {"home": {"odds": 1.80, "book": "dk"}, "away": {"odds": 2.25, "book": "fd"}}
    p = build_value_payload(model, raw, bp, n_books=12)
    m, v = p["market"], p["value"]
    assert abs(m["implied"]["home"] + m["implied"]["away"] - 1.0) < 1e-3
    assert "draw" not in m["implied"] and "draw" not in m["best_price"]
    assert m["overround"] == pytest.approx(1.04, abs=1e-4)
    assert m["n_books"] == 12
    assert set(v["edge"]) == {"home", "away"}
    assert v["rating"] in {"no_value", "marginal", "value", "strong_value"}
    assert p["clv"]["closing_odds"] is None and p["clv"]["realized_clv"] is None


def test_no_value_bet_unless_edge_validated():
    model = {"home": 0.65, "away": 0.35}
    raw = {"home": 0.52, "away": 0.52}
    bp = {"home": {"odds": 2.00, "book": "dk"}, "away": {"odds": 2.00, "book": "fd"}}
    cons = {"home": 1.92, "away": 1.92}
    gated = build_value_payload(model, raw, bp, 8, consensus_odds=cons, edge_validated=False)
    assert gated["value"]["value_bet"] is None and gated["value"]["gated"]
    assert gated["value"]["rating"] == "no_value" and gated["clv"]["bet_time_odds"] is None
    ok = build_value_payload(model, raw, bp, 8, consensus_odds=cons, edge_validated=True)
    vb = ok["value"]["value_bet"]
    assert vb["outcome"] == "home" and vb["price"] == 2.00 and vb["ev_at_consensus"] == pytest.approx(0.65 * 1.92 - 1, abs=1e-4)
    assert ok["value"]["gated"] is None


def test_best_price_alone_is_not_value():
    # model == fair consensus; one book is generous. Old rule called this value (EV>0 at best price).
    raw = {"home": 0.52, "away": 0.52}                 # fair 0.5 / 0.5
    model = {"home": 0.51, "away": 0.49}
    bp = {"home": {"odds": 2.10, "book": "outlier"}, "away": {"odds": 1.95, "book": "fd"}}
    p = build_value_payload(model, raw, bp, 8, consensus_odds={"home": 1.92, "away": 1.92}, edge_validated=True)
    assert p["value"]["value_bet"] is None
    assert p["value"]["ev_at_best"]["home"] > 0        # still reported, just not a bet


def test_value_bet_needs_positive_ev_at_consensus():
    raw = {"home": 0.60, "away": 0.48}                 # fair ~0.556 home, consensus home 1.667
    model = {"home": 0.59, "away": 0.41}               # +3.4pp edge but EV at consensus < 0
    bp = {"home": {"odds": 1.80, "book": "dk"}, "away": {"odds": 2.20, "book": "fd"}}
    p = build_value_payload(model, raw, bp, 8, consensus_odds={"home": 1.667, "away": 2.083}, edge_validated=True)
    assert p["value"]["value_bet"] is None


def test_payload_degrades_without_model_or_market():
    p = build_value_payload(None, {"home": 0.5, "away": 0.55}, None, 3)
    assert p["market"] is not None and p["value"] is None
    p2 = build_value_payload({"home": 0.5, "away": 0.5}, None, None, None)
    assert p2["market"] is None and p2["value"] is None


def test_rating_tiers():
    assert rating(None) == "no_value" and rating(-0.01) == "no_value"
    assert rating(0.01) == "marginal" and rating(0.05) == "value" and rating(0.2) == "strong_value"


def test_kelly_zero_without_edge():
    assert kelly(0.5, 1.9) == 0.0 and kelly(0.6, 1.9) > 0


def test_track_record_defaults_false():
    tr = model_track_record("v3_multisport_football", None)
    assert tr["edge_validated"] is False and tr["model"] == "v3_multisport_football"
    tr2 = model_track_record("v3_multisport_football", {"edge_validated": True, "validation": "x", "n": 150})
    assert tr2["edge_validated"] is True and tr2["n_settled"] == 150
