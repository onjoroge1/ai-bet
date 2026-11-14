from datetime import datetime, timedelta, timezone

from snapbet_pipeline.espn_scores import _loose, collect_results_espn, match_fixture

T = datetime(2026, 11, 13, 0, 10, tzinfo=timezone.utc)


def _g(home, away, t=T, hs=4, as_=2):
    return {"home": home, "away": away, "commence": t, "home_score": hs, "away_score": as_}


def test_loose_names():
    assert _loose("Montréal Canadiens") == _loose("Montreal Canadiens")
    assert _loose("Florida St Seminoles") == _loose("Florida State Seminoles")
    assert _loose("Mt. St. Mary's Mountaineers") == _loose("Mount St. Mary's Mountaineers")
    assert _loose("St. John's Red Storm") != _loose("John's State Red Storm")


def test_match_exact_loose_weak_and_ambiguous():
    fx = [("e1", "Boston Bruins", "Montréal Canadiens", T),
          ("e2", "Texas A&M-CC Islanders", "Florida St Seminoles", T + timedelta(hours=1)),
          ("e3", "Boston Bruins", "Montréal Canadiens", T + timedelta(days=2))]
    assert match_fixture(_g("Boston Bruins", "Montreal Canadiens"), fx)[0] == "e1"
    # one side differs too much -> single-team match within 3h, unique
    assert match_fixture(_g("Texas A&M-Corpus Christi Islanders", "Florida State Seminoles", T), fx)[0] == "e2"
    # nothing within 12h
    assert match_fixture(_g("Boston Bruins", "Montreal Canadiens", T + timedelta(days=1)), fx) is None
    # weak match that fits two fixtures -> no match
    fx2 = [("a", "X Tigers", "Y Bears", T), ("b", "X Tigers", "Z Owls", T + timedelta(hours=1))]
    assert match_fixture(_g("X Tigers", "Q Hawks"), fx2) is None


class _Resp:
    def __init__(self, data):
        self.data, self.status_code = data, 200

    def json(self):
        return self.data

    def raise_for_status(self):
        pass


def _scoreboard(home, away, hs, as_, when):
    return {"events": [{"date": when, "season": {"type": 2}, "competitions": [{
        "date": when, "status": {"type": {"completed": True}},
        "competitors": [{"homeAway": "home", "score": str(hs), "team": {"displayName": home}},
                        {"homeAway": "away", "score": str(as_), "team": {"displayName": away}}]}]}]}


class _Client:
    def __init__(self):
        self.calls = 0

    def get_scores(self, sport_key, days_from):
        self.calls += 1
        return []

    def quota(self):
        return {}


def test_collect_results_espn_stores_finals_and_throttles_fallback(conn):
    now = datetime(2026, 11, 13, 6, 17, tzinfo=timezone.utc)
    with conn.cursor() as cur:
        for eid, h, a, t in (("ev-bos", "Boston Bruins", "Montréal Canadiens", T),
                             ("ev-ppd", "Los Angeles Kings", "Nashville Predators", T - timedelta(hours=2))):
            cur.execute("""INSERT INTO multisport_fixtures (sport, sport_key, event_id, home_team, away_team, commence_time)
                           VALUES ('hockey', 'icehockey_nhl', %s, %s, %s, %s)""", (eid, h, a, t))
    conn.commit()

    def fetch(url, params=None, timeout=None):
        if params["dates"] == "20261112":
            return _Resp(_scoreboard("Boston Bruins", "Montreal Canadiens", 3, 4, T.isoformat()))
        return _Resp({"events": []})

    client = _Client()
    res = collect_results_espn(conn, client, ["icehockey_nhl"], now=now, fetch=fetch)["icehockey_nhl"]
    assert res["matched"] == 1 and res["fixtures_finished"] == 1 and res["stale_fixtures"] == 1
    assert client.calls == 1                       # 06:17 UTC -> fallback hour
    with conn.cursor() as cur:
        cur.execute("SELECT status, home_score, away_score, outcome FROM multisport_fixtures WHERE event_id='ev-bos'")
        assert cur.fetchone() == ("finished", 3, 4, "A")
    collect_results_espn(conn, client, ["icehockey_nhl"], now=now + timedelta(hours=1), fetch=fetch)
    assert client.calls == 1                       # 07:17 -> no paid call
