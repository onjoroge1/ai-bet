from datetime import datetime, timezone

from snapbet_pipeline.consensus import best_prices, calculate_consensus, parse_bookmaker, per_book

from .factories import odds_event

T = datetime(2026, 11, 8, 18, 0, tzinfo=timezone.utc)


def test_parse_bookmaker_two_way_devig():
    ev = odds_event("e1", "americanfootball_nfl", "Home FC", "Away FC", T, p_home=0.6, spread=-3.5, total=47.5,
                    jitter=0.0)
    b = parse_bookmaker(ev["bookmakers"][0], "Home FC", "Away FC")
    assert b["home_odds"] > 1 and b["away_odds"] > 1
    assert abs(b["home_prob"] + b["away_prob"] - 1.0) < 1e-6
    assert b["overround"] > 1.0                      # vig present before de-vig
    assert b["spread"] == -3.5 and b["total"] == 47.5
    assert b["spread_home_odds"] == 1.91 and b["over_odds"] == 1.91


def test_parse_bookmaker_requires_both_sides():
    bm = {"key": "x", "markets": [{"key": "h2h", "outcomes": [{"name": "Home FC", "price": 1.5}]}]}
    assert parse_bookmaker(bm, "Home FC", "Away FC") is None


def test_consensus_sums_to_one_and_counts_books():
    ev = odds_event("e2", "basketball_nba", "A", "B", T, p_home=0.55, spread=-2.5, total=224.5, jitter=0.0)
    c = calculate_consensus(ev)
    assert c["n_bookmakers"] == 3
    assert abs(c["home_prob"] + c["away_prob"] - 1.0) < 1e-4
    assert abs(c["home_prob"] - 0.55) < 0.01        # de-vig recovers the fair line (no jitter)
    assert c["spread"] == -2.5 and c["total"] == 224.5
    assert "draw_prob" not in c


def test_consensus_none_without_books():
    assert calculate_consensus({"home_team": "A", "away_team": "B", "bookmakers": []}) is None


def test_best_prices_picks_max_per_side():
    books = {"dk": {"home_odds": 1.80, "away_odds": 2.10}, "fd": {"home_odds": 1.85, "away_odds": 2.05},
             "mgm": {"home_odds": 1.78, "away_odds": 2.20}}
    bp = best_prices(books)
    assert bp["home"] == {"odds": 1.85, "book": "fd"}
    assert bp["away"] == {"odds": 2.2, "book": "mgm"}
    assert best_prices({}) is None


def test_per_book_keyed_by_bookmaker():
    ev = odds_event("e3", "basketball_ncaab", "A", "B", T, p_home=0.7, spread=-8.5, total=140.5)
    pb = per_book(ev)
    assert set(pb) == {"draftkings", "fanduel", "betmgm"}
