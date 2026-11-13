from datetime import datetime, timedelta, timezone

from snapbet_pipeline.kalshi import collect_kalshi, is_ladder_quiet, main_rungs, store_markets, team_code, team_for_market

NOW = datetime(2026, 11, 13, 18, 0, tzinfo=timezone.utc)
TIP = datetime(2026, 11, 14, 1, 40, tzinfo=timezone.utc)
OCC = "2026-11-14T04:30:00Z"
NO_SLEEP = lambda s: None


class _Resp:
    def __init__(self, payload, status=200):
        self._p, self.status_code = payload, status

    def json(self):
        return self._p


def _market(ticker, bid, ask, occurrence=OCC, sub=None, strike=None):
    m = {"ticker": ticker, "event_ticker": ticker.rsplit("-", 1)[0], "status": "active",
         "yes_bid_dollars": bid, "yes_ask_dollars": ask, "last_price_dollars": ask,
         "volume_fp": "1000.00", "volume_24h_fp": "50.00", "open_interest_fp": "900.00",
         "occurrence_datetime": occurrence, "yes_sub_title": sub or ticker.rsplit("-", 1)[1]}
    if strike is not None:
        m.update(strike_type="greater", floor_strike=strike)
    else:
        m.update(strike_type="structured", floor_strike=None)
    return m


def _fetch_from(pages):
    calls = []

    def fetch(url, params=None, timeout=None):
        calls.append(dict(params))
        series = params["series_ticker"]
        seq = pages.get(series, [{"markets": []}])
        n = len([c for c in calls if c["series_ticker"] == series])
        return _Resp(seq[min(n - 1, len(seq) - 1)])
    fetch.calls = calls
    return fetch


def _fixture(conn, event_id, home, away, when, sport_key="basketball_nba"):
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO multisport_fixtures (sport, sport_key, event_id, home_team, away_team, commence_time)
                       VALUES ('basketball', %s, %s, %s, %s, %s)""", (sport_key, event_id, home, away, when))
    conn.commit()


def _rows(conn, cols="market_type, team, event_id, is_home, line"):
    with conn.cursor() as cur:
        cur.execute(f"SELECT {cols} FROM multisport_kalshi_snapshots ORDER BY kalshi_ticker, ts_recorded")
        return cur.fetchall()


def test_codes_and_quiet_ladders():
    assert team_for_market("basketball_nba", "KXNBAGAME-26NOV13UTAHOU-HOU") == "Houston Rockets"
    assert team_for_market("icehockey_nhl", "KXNHLGAME-26NOV13LAVGK-LA") == "Los Angeles Kings"
    spread = _market("KXNBASPREAD-26NOV13UTAHOU-HOU12", "0.40", "0.42", strike=11.5)
    assert team_code(spread, "spread") == "HOU"
    assert team_code(_market("KXNBATOTAL-26NOV13UTAHOU-231", "0.5", "0.5", strike=230.5), "total") is None
    assert team_code(_market("KXNFL1H-26NOV16LACBAL-TIE", "0.1", "0.1"), "1h") is None
    assert is_ladder_quiet(_market("X-Y-Z1", "0.00", "0.02", strike=1))
    assert is_ladder_quiet(_market("X-Y-Z1", None, None, strike=1))
    assert is_ladder_quiet(_market("X-Y-Z1", "0.98", "0.99", strike=1))
    assert not is_ladder_quiet(_market("X-Y-Z1", "0.00", "0.05", strike=1))


def test_all_series_link_to_fixture_and_quiet_rungs_are_skipped(conn):
    _fixture(conn, "ev-hou", "Houston Rockets", "Utah Jazz", TIP)
    _fixture(conn, "ev-hou-next-week", "Houston Rockets", "Utah Jazz", TIP + timedelta(days=7))
    fetch = _fetch_from({
        "KXNBAGAME": [{"markets": [_market("KXNBAGAME-26NOV13UTAHOU-HOU", "0.9100", "0.9200", sub="Houston"),
                                   _market("KXNBAGAME-26NOV13UTAHOU-UTA", "0.0800", "0.0900", sub="Utah")]}],
        "KXNBASPREAD": [{"markets": [_market("KXNBASPREAD-26NOV13UTAHOU-HOU12", "0.48", "0.50", strike=11.5),
                                     _market("KXNBASPREAD-26NOV13UTAHOU-HOU30", "0.00", "0.01", strike=29.5)]}],
        "KXNBATOTAL": [{"markets": [_market("KXNBATOTAL-26NOV13UTAHOU-231", "0.50", "0.51", strike=230.5)]}],
    })
    res = collect_kalshi(conn, ["basketball_nba"], now=NOW, fetch=fetch, sleep=NO_SLEEP)
    assert res["basketball_nba"] == {"games": 1, "matched": 1, "unmatched": 0, "skipped_ladder": 1,
                                     "snapshots": 4, "status": "ok"}
    rows = _rows(conn)
    assert ("game", "Houston Rockets", "ev-hou", True, None) in rows
    assert ("game", "Utah Jazz", "ev-hou", False, None) in rows
    assert ("spread", "Houston Rockets", "ev-hou", True, 11.5) in [(a, b, c, d, float(e) if e else None)
                                                                   for a, b, c, d, e in rows]
    assert ("total", None, "ev-hou", None) in [r[:4] for r in rows]


def test_in_play_and_far_future_games_are_not_captured(conn):
    fetch = _fetch_from({"KXNBAGAME": [{"markets": [
        _market("KXNBAGAME-26NOV13AAABBB-AAA", "0.5", "0.5", occurrence="2026-11-13T19:00:00Z"),  # started
        _market("KXNBAGAME-26NOV20CCCDDD-CCC", "0.5", "0.5", occurrence="2026-11-20T04:00:00Z"),  # > 48h out
    ]}]})
    res = collect_kalshi(conn, ["basketball_nba"], now=NOW, fetch=fetch, sleep=NO_SLEEP)
    assert res["basketball_nba"]["games"] == 0 and _rows(conn) == []


def test_unmatched_game_is_stored_then_backfilled_with_teams(conn):
    pages = {"KXNBAGAME": [{"markets": [_market("KXNBAGAME-26NOV13UTAHOU-HOU", "0.91", "0.92"),
                                        _market("KXNBAGAME-26NOV13UTAHOU-UTA", "0.08", "0.09")]}],
             "KXNBASPREAD": [{"markets": [_market("KXNBASPREAD-26NOV13UTAHOU-HOU12", "0.48", "0.50", strike=11.5)]}]}
    collect_kalshi(conn, ["basketball_nba"], now=NOW, fetch=_fetch_from(pages), sleep=NO_SLEEP)
    assert {r[2] for r in _rows(conn)} == {None}
    again = collect_kalshi(conn, ["basketball_nba"], now=NOW, fetch=_fetch_from(pages), sleep=NO_SLEEP)
    assert again["basketball_nba"]["snapshots"] == 0  # same timestamp: idempotent
    _fixture(conn, "ev-hou", "Houston Rockets", "Utah Jazz", TIP)
    collect_kalshi(conn, ["basketball_nba"], now=NOW + timedelta(hours=1), fetch=_fetch_from(pages), sleep=NO_SLEEP)
    assert {(r[1], r[2], r[3]) for r in _rows(conn)} == {("Houston Rockets", "ev-hou", True),
                                                         ("Utah Jazz", "ev-hou", False)}


def test_college_names_match_uniquely_or_not_at_all(conn):
    _fixture(conn, "ev-rut", "Rutgers Scarlet Knights", "Houston Cougars", TIP, sport_key="basketball_ncaab")
    _fixture(conn, "ev-mia1", "Miami Hurricanes", "Duke Blue Devils", TIP, sport_key="basketball_ncaab")
    _fixture(conn, "ev-mia2", "Miami RedHawks", "Duke Blue Devils", TIP, sport_key="basketball_ncaab")
    fetch = _fetch_from({
        "KXNCAAMBGAME": [{"markets": [
            _market("KXNCAAMBGAME-26NOV13HOURUTG-RUTG", "0.40", "0.41", sub="Rutgers"),
            _market("KXNCAAMBGAME-26NOV13HOURUTG-HOU", "0.59", "0.60", sub="Houston"),
            _market("KXNCAAMBGAME-26NOV13DUKEMIA-MIA", "0.30", "0.31", sub="Miami"),
            _market("KXNCAAMBGAME-26NOV13DUKEMIA-DUKE", "0.69", "0.70", sub="Duke"),
        ]}],
        "KXNCAAMBSPREAD": [{"markets": [_market("KXNCAAMBSPREAD-26NOV13HOURUTG-HOU4", "0.5", "0.5", strike=3.5)]}],
    })
    res = collect_kalshi(conn, ["basketball_ncaab"], now=NOW, fetch=fetch, sleep=NO_SLEEP)
    assert res["basketball_ncaab"]["matched"] == 1 and res["basketball_ncaab"]["unmatched"] == 1
    linked = {(r[0], r[1], r[2]) for r in _rows(conn) if r[2]}
    assert linked == {("game", "Rutgers Scarlet Knights", "ev-rut"), ("game", "Houston Cougars", "ev-rut"),
                      ("spread", "Houston Cougars", "ev-rut")}


def test_series_errors_are_isolated(conn):
    fetch = _fetch_from({
        "KXNBAGAME": [{"markets": [_market("KXNBAGAME-26NOV13PORSAC-POR", "0.81", "0.82")], "cursor": "c2"},
                      {"markets": [_market("KXNBAGAME-26NOV13PORSAC-SAC", "0.18", "0.19")], "cursor": ""}],
    })
    bad = lambda url, params=None, timeout=None: (_Resp({}, 503) if params["series_ticker"].startswith("KXNHL")
                                                    else fetch(url, params=params, timeout=timeout))
    res = collect_kalshi(conn, ["icehockey_nhl", "basketball_nba", "americanfootball_cfl"],
                         now=NOW, fetch=bad, sleep=NO_SLEEP)
    assert res["icehockey_nhl"]["status"] == "error"
    assert res["basketball_nba"]["snapshots"] == 2 and res["basketball_nba"]["status"] == "ok"
    assert [c.get("cursor") for c in fetch.calls if c["series_ticker"] == "KXNBAGAME"] == [None, "c2"]
    assert res["americanfootball_cfl"] == {"status": "no_kalshi_series"}


def test_rate_limit_is_retried(conn):
    seq = [_Resp({}, 429), _Resp({"markets": [_market("KXNBAGAME-26NOV13PORSAC-POR", "0.81", "0.82")]})]
    waits = []

    def fetch(url, params=None, timeout=None):
        return seq.pop(0) if params["series_ticker"] == "KXNBAGAME" and seq else _Resp({"markets": []})
    res = collect_kalshi(conn, ["basketball_nba"], now=NOW, fetch=fetch, sleep=waits.append)
    assert res["basketball_nba"]["snapshots"] == 1 and 1 in waits


def test_main_rungs_keep_three_nearest_even_per_ladder():
    prices = {"5": "0.80", "8": "0.62", "11": "0.50", "14": "0.38", "17": "0.20"}
    ms = [(_market(f"KXNBASPREAD-26NOV13UTAHOU-HOU{k}", p, p, strike=int(k) - 0.5), "spread") for k, p in prices.items()]
    ms += [(_market("KXNBASPREAD-26NOV13UTAHOU-UTA3", "0.10", "0.10", strike=2.5), "spread")]
    ms += [(_market("KXNBATOTAL-26NOV13UTAHOU-231", "0.30", "0.30", strike=230.5), "total")]
    assert main_rungs(ms) == {"KXNBASPREAD-26NOV13UTAHOU-HOU8", "KXNBASPREAD-26NOV13UTAHOU-HOU11",
                              "KXNBASPREAD-26NOV13UTAHOU-HOU14", "KXNBASPREAD-26NOV13UTAHOU-UTA3",
                              "KXNBATOTAL-26NOV13UTAHOU-231"}


def test_off_cadence_skips_ladders_except_near_tip(conn):
    soon = (NOW + timedelta(hours=4, minutes=30)).strftime("%Y-%m-%dT%H:%M:%SZ")   # starts in 1.5h
    later = (NOW + timedelta(hours=9)).strftime("%Y-%m-%dT%H:%M:%SZ")               # starts in 6h
    ms = [(_market("KXNBAGAME-26NOV13AAABBB-AAA", "0.5", "0.5", occurrence=soon), "game"),
          (_market("KXNBATOTAL-26NOV13AAABBB-220", "0.5", "0.5", occurrence=soon, strike=219.5), "total"),
          (_market("KXNBAGAME-26NOV13CCCDDD-CCC", "0.5", "0.5", occurrence=later), "game"),
          (_market("KXNBATOTAL-26NOV13CCCDDD-220", "0.5", "0.5", occurrence=later, strike=219.5), "total")]
    res = store_markets(conn, "basketball_nba", ms, NOW + timedelta(hours=1))  # 19:00 UTC: off cadence
    assert res["snapshots"] == 3 and res["skipped_ladder"] == 1


def test_college_single_name_match_needs_time_and_uniqueness(conn):
    tip0 = datetime(2026, 11, 14, 0, 0, tzinfo=timezone.utc)   # Kalshi occurrence = tip + 3h
    _fixture(conn, "ev-ncst", "NC State Wolfpack", "Troy Trojans", tip0, sport_key="basketball_ncaab")
    _fixture(conn, "ev-ou", "Oklahoma Sooners", "Fairleigh Dickinson Knights", tip0, sport_key="basketball_ncaab")
    _fixture(conn, "ev-osu", "Oklahoma State Cowboys", "Tulsa Golden Hurricane", tip0, sport_key="basketball_ncaab")
    occ = "2026-11-14T03:00:00Z"
    fetch = _fetch_from({"KXNCAAMBGAME": [{"markets": [
        _market("KXNCAAMBGAME-26NOV13TROYNCST-NCST", "0.9", "0.9", occurrence=occ, sub="NC St."),   # normalised
        _market("KXNCAAMBGAME-26NOV13TROYNCST-TROY", "0.1", "0.1", occurrence=occ, sub="Troy"),
        _market("KXNCAAMBGAME-26NOV13FDUOKLA-OKLA", "0.9", "0.9", occurrence=occ, sub="Oklahoma"),  # fits 2 teams
        _market("KXNCAAMBGAME-26NOV13FDUOKLA-FDU", "0.1", "0.1", occurrence=occ, sub="FDU"),
    ]}]})
    res = collect_kalshi(conn, ["basketball_ncaab"], now=NOW, fetch=fetch, sleep=NO_SLEEP)
    assert res["basketball_ncaab"]["matched"] == 1
    assert {(r[1], r[2]) for r in _rows(conn) if r[2]} == {("NC State Wolfpack", "ev-ncst"), ("Troy Trojans", "ev-ncst")}
