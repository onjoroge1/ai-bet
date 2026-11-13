from datetime import date, datetime, timedelta, timezone

from snapbet_pipeline.boxscores import collect_boxscores, parse_summary
from snapbet_pipeline.props import collect_props, due_events, parse_event_props

NOW = datetime(2026, 11, 13, 23, 17, tzinfo=timezone.utc)
NO_SLEEP = lambda s: None


def _event_odds():
    return {"id": "ev1", "bookmakers": [
        {"key": "draftkings", "markets": [
            {"key": "player_points", "last_update": "2026-11-13T23:00:00Z", "outcomes": [
                {"name": "Over", "description": "Jalen Brunson", "price": 1.87, "point": 26.5},
                {"name": "Under", "description": "Jalen Brunson", "price": 1.95, "point": 26.5}]}]},
        {"key": "fanduel", "markets": [
            {"key": "player_assists", "outcomes": [
                {"name": "Over", "description": "Jalen Brunson", "price": 2.14, "point": 6.5},
                {"name": "Under", "description": None, "price": 1.7, "point": 6.5}]}]}]}


def test_parse_event_props_skips_incomplete_outcomes():
    rows = parse_event_props(_event_odds())
    assert len(rows) == 2
    assert rows[0] == {"bookmaker": "draftkings", "market": "player_points", "player_name": "Jalen Brunson",
                       "line": 26.5, "over_price": 1.87, "under_price": 1.95,
                       "book_update": datetime(2026, 11, 13, 23, 0, tzinfo=timezone.utc)}
    assert rows[1]["over_price"] == 2.14 and rows[1]["under_price"] is None


def test_due_events_window_and_already_pulled():
    evs = [{"id": "a", "commence_time": "2026-11-14T00:10:00Z"},    # 53 min out -> due
           {"id": "b", "commence_time": "2026-11-14T02:40:00Z"},    # too far
           {"id": "c", "commence_time": "2026-11-13T23:00:00Z"},    # started
           {"id": "d", "commence_time": "2026-11-14T00:40:00Z"}]    # due but already pulled
    assert [e["id"] for e in due_events(evs, {"d"}, NOW)] == ["a"]


class _Client:
    def __init__(self):
        self.odds_calls = []

    def get_events(self, sport_key):
        return [{"id": "ev1", "commence_time": "2026-11-14T00:10:00Z", "home_team": "Indiana Pacers",
                 "away_team": "New York Knicks"},
                {"id": "ev2", "commence_time": "2026-11-14T00:30:00Z", "home_team": "A", "away_team": "B"}]

    def get_event_odds(self, sport_key, event_id, markets):
        self.odds_calls.append(event_id)
        return _event_odds()

    def quota(self):
        return {}


def test_collect_props_pulls_each_game_once_within_credit_cap(conn):
    client = _Client()
    res = collect_props(conn, client, ["basketball_nba", "icehockey_nhl"], now=NOW, max_credits=4)
    assert res["basketball_nba"] == {"due": 2, "pulled": 1, "rows": 2, "status": "credit_cap"}
    assert "icehockey_nhl" not in res                       # no prop markets configured
    again = collect_props(conn, client, ["basketball_nba"], now=NOW + timedelta(minutes=5))
    assert again["basketball_nba"]["pulled"] == 1 and client.odds_calls == ["ev1", "ev2"]
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(DISTINCT event_id), COUNT(*) FROM multisport_player_props")
        assert cur.fetchone() == (2, 4)


def _summary(eid="401", home="Philadelphia 76ers", away="Toronto Raptors"):
    keys = ["minutes", "points", "fieldGoalsMade-fieldGoalsAttempted",
            "threePointFieldGoalsMade-threePointFieldGoalsAttempted", "freeThrowsMade-freeThrowsAttempted",
            "rebounds", "assists", "turnovers", "steals", "blocks", "offensiveRebounds", "defensiveRebounds",
            "fouls", "plusMinus"]
    def team(tid, name, players):
        return {"team": {"id": tid, "displayName": name}, "statistics": [{"keys": keys, "athletes": players}]}
    return {"header": {"competitions": [{"date": "2026-11-13T00:00Z", "competitors": [
                {"team": {"id": "1"}, "homeAway": "home"}, {"team": {"id": "2"}, "homeAway": "away"}]}]},
            "boxscore": {"players": [
                team("1", home, [{"athlete": {"id": "11", "displayName": "Tyrese Maxey"}, "starter": True,
                                  "stats": ["38", "30", "11-22", "4-9", "4-4", "5", "7", "2", "1", "0", "1", "4", "2", "+6"]},
                                 {"athlete": {"id": "12", "displayName": "Bench Guy"}, "starter": False,
                                  "didNotPlay": True, "reason": "COACH'S DECISION", "stats": []}]),
                team("2", away, [{"athlete": {"id": "21", "displayName": "RJ Barrett"}, "starter": True,
                                  "stats": ["37", "31", "13-20", "4-7", "1-2", "14", "5", "3", "0", "0", "0", "14", "2", "-5"]}])]}}


def test_parse_summary_reads_stats_and_dnp():
    rows = {r["player_name"]: r for r in parse_summary(_summary(), "basketball_nba")}
    m = rows["Tyrese Maxey"]
    assert (m["team"], m["opponent"], m["is_home"], m["points"], m["threes_made"], m["threes_att"], m["plus_minus"]) == \
           ("Philadelphia 76ers", "Toronto Raptors", True, 30, 4, 9, 6)
    assert rows["Bench Guy"]["did_not_play"] and rows["Bench Guy"]["points"] is None
    assert rows["RJ Barrett"]["is_home"] is False and rows["RJ Barrett"]["rebounds"] == 14


class _Resp:
    def __init__(self, payload, status=200):
        self._p, self.status_code = payload, status

    def json(self):
        return self._p


def test_collect_boxscores_stores_final_games_once_and_links_fixture(conn):
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO multisport_fixtures (sport, sport_key, event_id, home_team, away_team, commence_time)
                       VALUES ('basketball', 'basketball_nba', 'odds-ev', 'Philadelphia 76ers', 'Toronto Raptors',
                               '2026-11-13T00:10:00Z')""")
    conn.commit()
    calls = []

    def fetch(url, params=None, timeout=None):
        calls.append(url.rsplit("/", 1)[1])
        if url.endswith("scoreboard"):
            return _Resp({"events": [{"id": "401", "date": "2026-11-13T00:00Z", "status": {"type": {"name": "STATUS_FINAL"}}},
                                     {"id": "402", "date": "2026-11-13T03:00Z", "status": {"type": {"name": "STATUS_IN_PROGRESS"}}}]})
        return _Resp(_summary())
    res = collect_boxscores(conn, ["basketball_nba", "icehockey_nhl"], [date(2026, 11, 12)], fetch=fetch, sleep=NO_SLEEP)
    assert res == {"basketball_nba": {"final_games": 1, "new_games": 1, "linked": 1, "players": 3, "status": "ok"}}
    again = collect_boxscores(conn, ["basketball_nba"], [date(2026, 11, 12)], fetch=fetch, sleep=NO_SLEEP)
    assert again["basketball_nba"]["new_games"] == 0
    assert calls.count("summary") == 1
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*), COUNT(*) FILTER (WHERE event_id = 'odds-ev') FROM multisport_player_boxscores")
        assert cur.fetchone() == (3, 3)
