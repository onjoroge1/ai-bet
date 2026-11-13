"""Pure odds math on a single Odds-API event. No I/O — fully unit-tested.

Event shape (The Odds API v4 /odds):
{
  "id": "...", "sport_key": "americanfootball_nfl", "sport_title": "NFL",
  "commence_time": "2026-11-08T18:00:00Z",
  "home_team": "Buffalo Bills", "away_team": "Miami Dolphins",
  "bookmakers": [
    {"key": "draftkings", "title": "DraftKings", "last_update": "...",
     "markets": [
        {"key": "h2h", "outcomes": [{"name": "Buffalo Bills", "price": 1.57}, {"name": "Miami Dolphins", "price": 2.45}]},
        {"key": "spreads", "outcomes": [{"name": "Buffalo Bills", "price": 1.91, "point": -6.5}, {"name": "Miami Dolphins", "price": 1.91, "point": 6.5}]},
        {"key": "totals", "outcomes": [{"name": "Over", "price": 1.91, "point": 47.5}, {"name": "Under", "price": 1.91, "point": 47.5}]}
     ]}
  ]
}
"""
from __future__ import annotations

from statistics import mean
from typing import Dict, List, Optional


def _outcomes(market: Dict) -> Dict[str, Dict]:
    return {o.get("name"): o for o in market.get("outcomes", []) if o.get("name")}


def parse_bookmaker(bookmaker: Dict, home_team: str, away_team: str) -> Optional[Dict]:
    """One bookmaker's h2h/spread/total for an event. None if no two-way h2h."""
    out: Dict = {}
    for market in bookmaker.get("markets", []):
        key = market.get("key")
        oc = _outcomes(market)
        if key == "h2h":
            h, a = oc.get(home_team), oc.get(away_team)
            if h and a and h.get("price") and a.get("price") and h["price"] > 1 and a["price"] > 1:
                ph, pa = 1.0 / h["price"], 1.0 / a["price"]
                overround = ph + pa
                out.update(home_odds=float(h["price"]), away_odds=float(a["price"]),
                           home_prob=round(ph / overround, 4), away_prob=round(pa / overround, 4),
                           overround=round(overround, 4))
        elif key == "spreads":
            h, a = oc.get(home_team), oc.get(away_team)
            if h and h.get("point") is not None:
                out.update(spread=float(h["point"]), spread_home_odds=h.get("price"),
                           spread_away_odds=(a or {}).get("price"))
        elif key == "totals":
            over, under = oc.get("Over"), oc.get("Under")
            if over and over.get("point") is not None:
                out.update(total=float(over["point"]), over_odds=over.get("price"),
                           under_odds=(under or {}).get("price"))
    return out if "home_odds" in out else None


def calculate_consensus(event: Dict) -> Optional[Dict]:
    """Average h2h price across books, de-vigged proportionally; latest spread/total.

    Returns None when fewer than one book quotes both sides of the moneyline.
    """
    home, away = event.get("home_team"), event.get("away_team")
    books = [parse_bookmaker(b, home, away) for b in event.get("bookmakers", [])]
    books = [b for b in books if b]
    if not books:
        return None

    avg_home = mean(b["home_odds"] for b in books)
    avg_away = mean(b["away_odds"] for b in books)
    ph, pa = 1.0 / avg_home, 1.0 / avg_away
    overround = ph + pa
    cons: Dict = {
        "home_odds": round(avg_home, 3),
        "away_odds": round(avg_away, 3),
        "home_prob": round(ph / overround, 4),
        "away_prob": round(pa / overround, 4),
        "overround": round(overround, 4),
        "n_bookmakers": len(books),
    }
    spreads = [b for b in books if "spread" in b]
    if spreads:
        # median spread line is more robust than "last book listed"
        lines = sorted(b["spread"] for b in spreads)
        med = lines[len(lines) // 2]
        pick = next(b for b in spreads if b["spread"] == med)
        cons.update(spread=med, spread_home_odds=pick.get("spread_home_odds"),
                    spread_away_odds=pick.get("spread_away_odds"))
    totals = [b for b in books if "total" in b]
    if totals:
        lines = sorted(b["total"] for b in totals)
        med = lines[len(lines) // 2]
        pick = next(b for b in totals if b["total"] == med)
        cons.update(total=med, over_odds=pick.get("over_odds"), under_odds=pick.get("under_odds"))
    return cons


def per_book(event: Dict) -> Dict[str, Dict]:
    """{bookmaker_key: parsed} for every book with a two-way moneyline."""
    home, away = event.get("home_team"), event.get("away_team")
    out = {}
    for b in event.get("bookmakers", []):
        parsed = parse_bookmaker(b, home, away)
        if parsed and b.get("key"):
            out[b["key"]] = parsed
    return out


def best_prices(books: Dict[str, Dict]) -> Optional[Dict[str, Dict]]:
    """Max decimal odds per side across books -> {"home": {"odds", "book"}, "away": {...}}."""
    bp: Dict[str, Dict] = {}
    for key, b in books.items():
        for side in ("home", "away"):
            odds = b.get(f"{side}_odds")
            if odds and odds > 1.0 and (side not in bp or odds > bp[side]["odds"]):
                bp[side] = {"odds": round(float(odds), 3), "book": key}
    return bp or None
