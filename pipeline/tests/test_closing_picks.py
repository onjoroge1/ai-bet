from snapbet_pipeline.closing import parse_three_way
from snapbet_pipeline.config import B2B_HOURS
from snapbet_pipeline.picks import select_picks


def _ev(books):
    return {"home_team": "Boston Bruins", "away_team": "Los Angeles Kings", "bookmakers": [
        {"key": k, "markets": [{"key": "h2h_3_way", "outcomes": [
            {"name": "Boston Bruins", "price": h}, {"name": "Los Angeles Kings", "price": a},
            {"name": "Draw", "price": d}]}]} for k, h, a, d in books]}


def test_parse_three_way_devigs_each_book_and_consensus():
    out = parse_three_way(_ev([("dk", 2.0, 2.85, 4.3), ("fd", 1.95, 3.1, 4.4)]))
    assert set(out) == {"dk", "fd", "consensus"}
    for d in out.values():
        assert abs(d["home_prob"] + d["draw_prob"] + d["away_prob"] - 1) < 1e-3 and d["overround"] > 1
    c = out["consensus"]
    assert c["n_bookmakers"] == 2 and c["home_odds"] == 1.975 and c["home_prob"] > c["away_prob"] > c["draw_prob"]


def test_parse_three_way_skips_incomplete_books():
    ev = _ev([("dk", 2.0, 2.85, 4.3)])
    ev["bookmakers"].append({"key": "bad", "markets": [{"key": "h2h_3_way", "outcomes": [
        {"name": "Boston Bruins", "price": 2.0}, {"name": "Draw", "price": 4.0}]}]})
    ev["bookmakers"].append({"key": "h2h_only", "markets": [{"key": "h2h", "outcomes": []}]})
    assert set(parse_three_way(ev)) == {"dk", "consensus"}
    assert parse_three_way({"home_team": "A", "away_team": "B", "bookmakers": []}) == {}


def test_picks_never_fill_slots_below_the_floor():
    favs = [{"pick": "Spurs", "sport": "nba", "prob": 0.9}, {"pick": "Rams", "sport": "nfl", "prob": 0.8},
            {"pick": "Wild", "sport": "nhl", "prob": 0.64}, {"pick": "Lightning", "sport": "nhl", "prob": 0.6}]
    assert [p["pick"] for p in select_picks(favs)] == ["Spurs", "Rams"]
    favs.insert(1, {"pick": "Hurricanes", "sport": "nhl", "prob": 0.85})
    assert [p["pick"] for p in select_picks(favs, n=2)] == ["Spurs", "Hurricanes"]


def test_back_to_back_threshold_covers_afternoon_then_evening():
    assert 31 <= B2B_HOURS < 40
