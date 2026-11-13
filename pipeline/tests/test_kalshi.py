from datetime import datetime, timedelta, timezone

from snapbet_pipeline.kalshi import collect_kalshi, team_for_market

NOW = datetime(2026, 11, 13, 18, 0, tzinfo=timezone.utc)
TIP = datetime(2026, 11, 14, 1, 40, tzinfo=timezone.utc)


class _Resp:
    def __init__(self, payload, status=200):
        self._p, self.status_code = payload, status

    def json(self):
        return self._p


def _market(ticker, bid, ask, occurrence="2026-11-14T04:30:00Z"):
    return {"ticker": ticker, "event_ticker": ticker.rsplit("-", 1)[0], "status": "active",
            "yes_bid_dollars": bid, "yes_ask_dollars": ask, "last_price_dollars": ask,
            "volume_fp": "1000.00", "volume_24h_fp": "50.00", "open_interest_fp": "900.00",
            "occurrence_datetime": occurrence}


def _fetch_from(pages):
    calls = []

    def fetch(url, params=None, timeout=None):
        calls.append(dict(params))
        series = params["series_ticker"]
        seq = pages.get(series, [{"markets": []}])
        return _Resp(seq[min(len([c for c in calls if c["series_ticker"] == series]) - 1, len(seq) - 1)])
    fetch.calls = calls
    return fetch


def _fixture(conn, event_id, home, away, when, sport_key="basketball_nba"):
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO multisport_fixtures (sport, sport_key, event_id, home_team, away_team, commence_time)
                       VALUES ('basketball', %s, %s, %s, %s, %s)""", (sport_key, event_id, home, away, when))
    conn.commit()


def test_team_codes_resolve_including_overrides():
    assert team_for_market("basketball_nba", "KXNBAGAME-26NOV13UTAHOU-HOU") == "Houston Rockets"
    assert team_for_market("basketball_nba", "KXNBAGAME-26NOV13GSWSAS-GSW") == "Golden State Warriors"
    assert team_for_market("icehockey_nhl", "KXNHLGAME-26NOV13LAVGK-LA") == "Los Angeles Kings"


def test_collect_links_markets_to_fixture_and_marks_home(conn):
    _fixture(conn, "ev-hou", "Houston Rockets", "Utah Jazz", TIP)
    _fixture(conn, "ev-hou-next-week", "Houston Rockets", "Utah Jazz", TIP + timedelta(days=7))
    fetch = _fetch_from({"KXNBAGAME": [{"markets": [
        _market("KXNBAGAME-26NOV13UTAHOU-HOU", "0.9100", "0.9200"),
        _market("KXNBAGAME-26NOV13UTAHOU-UTA", "0.0800", "0.0900"),
    ]}]})
    res = collect_kalshi(conn, ["basketball_nba"], now=NOW, fetch=fetch)
    assert res["basketball_nba"] == {"events": 1, "matched": 1, "unmatched": 0, "snapshots": 2, "status": "ok"}
    with conn.cursor() as cur:
        cur.execute("""SELECT team, event_id, is_home, yes_bid, yes_ask, volume
                         FROM multisport_kalshi_snapshots ORDER BY team""")
        rows = cur.fetchall()
    assert [(r[0], r[1], r[2]) for r in rows] == [("Houston Rockets", "ev-hou", True),
                                                   ("Utah Jazz", "ev-hou", False)]
    assert float(rows[0][3]) == 0.91 and float(rows[0][4]) == 0.92 and float(rows[0][5]) == 1000.0


def test_unmatched_game_is_still_stored_and_rerun_is_idempotent(conn):
    fetch = _fetch_from({"KXNBAGAME": [{"markets": [_market("KXNBAGAME-26NOV13PORSAC-POR", "0.81", "0.82")]}]})
    first = collect_kalshi(conn, ["basketball_nba"], now=NOW, fetch=fetch)
    again = collect_kalshi(conn, ["basketball_nba"], now=NOW, fetch=fetch)
    assert first["basketball_nba"]["unmatched"] == 1 and first["basketball_nba"]["snapshots"] == 1
    assert again["basketball_nba"]["snapshots"] == 0
    with conn.cursor() as cur:
        cur.execute("SELECT event_id, team FROM multisport_kalshi_snapshots")
        assert cur.fetchall() == [(None, "Portland Trail Blazers")]


def test_later_match_backfills_earlier_unlinked_captures(conn):
    fetch = _fetch_from({"KXNBAGAME": [{"markets": [_market("KXNBAGAME-26NOV13UTAHOU-HOU", "0.91", "0.92")]}]})
    collect_kalshi(conn, ["basketball_nba"], now=NOW, fetch=fetch)
    _fixture(conn, "ev-hou", "Houston Rockets", "Utah Jazz", TIP)
    collect_kalshi(conn, ["basketball_nba"], now=NOW + timedelta(hours=1), fetch=fetch)
    with conn.cursor() as cur:
        cur.execute("SELECT event_id, is_home FROM multisport_kalshi_snapshots ORDER BY ts_recorded")
        assert cur.fetchall() == [("ev-hou", True), ("ev-hou", True)]


def test_pagination_and_errors_are_isolated_per_sport(conn):
    fetch = _fetch_from({
        "KXNBAGAME": [{"markets": [_market("KXNBAGAME-26NOV13PORSAC-POR", "0.81", "0.82")], "cursor": "c2"},
                      {"markets": [_market("KXNBAGAME-26NOV13PORSAC-SAC", "0.18", "0.19")], "cursor": ""}],
    })
    bad = lambda url, params=None, timeout=None: (_Resp({}, 503) if params["series_ticker"] == "KXNHLGAME"
                                                    else fetch(url, params=params, timeout=timeout))
    res = collect_kalshi(conn, ["icehockey_nhl", "basketball_nba", "basketball_ncaab"], now=NOW, fetch=bad)
    assert res["icehockey_nhl"]["status"] == "error"
    assert res["basketball_nba"]["snapshots"] == 2
    assert fetch.calls[1]["cursor"] == "c2"
    assert res["basketball_ncaab"] == {"status": "no_kalshi_series"}
