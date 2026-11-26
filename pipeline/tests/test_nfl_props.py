"""NFL box scores (ESPN) and grading NFL player props, including Yes-only anytime TD lines."""
from datetime import date, datetime, timezone

from snapbet_pipeline import prop_results, prop_shop
from snapbet_pipeline.boxscores import collect_boxscores, parse_nfl_summary

NO_SLEEP = lambda s: None


def _block(name, keys, athletes):
    return {"name": name, "keys": keys,
            "athletes": [{"athlete": {"id": pid, "displayName": n}, "stats": st} for pid, n, st in athletes]}


def _nfl_summary(home="Dallas Cowboys", away="Philadelphia Eagles"):
    home_blocks = [
        _block("passing", ["completions/passingAttempts", "passingYards", "yardsPerPassAttempt", "passingTouchdowns",
                           "interceptions"], [("1", "Dak Prescott", ["22/31", "268", "8.6", "2", "1"])]),
        _block("rushing", ["rushingAttempts", "rushingYards", "yardsPerRushAttempt", "rushingTouchdowns", "longRushing"],
               [("2", "Javonte Williams", ["18", "91", "5.1", "1", "22"]), ("1", "Dak Prescott", ["3", "12", "4.0", "0", "7"])]),
        _block("receiving", ["receptions", "receivingYards", "yardsPerReception", "receivingTouchdowns", "longReception",
                             "receivingTargets"], [("3", "CeeDee Lamb", ["7", "104", "14.9", "1", "38", "10"])]),
        _block("kickReturns", ["kickReturns", "kickReturnYards", "yardsPerKickReturn", "longKickReturn",
                               "kickReturnTouchdowns"], [("4", "KaVontae Turpin", ["2", "130", "65.0", "99", "1"])]),
    ]
    away_blocks = [
        _block("defensive", ["totalTackles", "soloTackles", "sacks", "tacklesForLoss", "passesDefended", "QBHits",
                             "defensiveTouchdowns"], [("9", "Cooper DeJean", ["5", "4", "0", "0", "2", "0", "1"])]),
        _block("interceptions", ["interceptions", "interceptionYards", "interceptionTouchdowns"],
               [("9", "Cooper DeJean", ["1", "38", "1"])]),
    ]
    return {"header": {"competitions": [{"date": "2026-11-26T21:30Z", "competitors": [
                {"team": {"id": "1"}, "homeAway": "home"}, {"team": {"id": "2"}, "homeAway": "away"}]}]},
            "boxscore": {"players": [{"team": {"id": "1", "displayName": home}, "statistics": home_blocks},
                                     {"team": {"id": "2", "displayName": away}, "statistics": away_blocks}]}}


def test_parse_nfl_summary_merges_blocks_and_counts_scoring_tds():
    rows = {r["player_name"]: r for r in parse_nfl_summary(_nfl_summary())}
    dak = rows["Dak Prescott"]
    assert (dak["pass_cmp"], dak["pass_att"], dak["pass_yds"], dak["pass_td"], dak["rush_yds"]) == (22, 31, 268, 2, 12)
    assert dak["scoring_td"] == 0                     # passing TDs do not count for anytime TD
    assert rows["Javonte Williams"]["rush_yds"] == 91 and rows["Javonte Williams"]["scoring_td"] == 1
    assert rows["Javonte Williams"]["receptions"] == 0   # no receiving block -> 0, not missing
    lamb = rows["CeeDee Lamb"]
    assert (lamb["receptions"], lamb["targets"], lamb["rec_yds"], lamb["scoring_td"]) == (7, 10, 104, 1)
    assert rows["KaVontae Turpin"]["return_td"] == 1 and rows["KaVontae Turpin"]["scoring_td"] == 1
    # defensiveTouchdowns already includes the pick-six: counted once
    assert rows["Cooper DeJean"]["def_td"] == 1 and rows["Cooper DeJean"]["scoring_td"] == 1
    assert rows["Cooper DeJean"]["is_home"] is False and rows["Cooper DeJean"]["opponent"] == "Dallas Cowboys"


class _Resp:
    def __init__(self, payload):
        self._p, self.status_code = payload, 200

    def json(self):
        return self._p


def _seed_nfl(conn):
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO multisport_fixtures (sport, sport_key, event_id, home_team, away_team, commence_time)
                       VALUES ('football', 'americanfootball_nfl', 'nfl-ev', 'Dallas Cowboys', 'Philadelphia Eagles',
                               '2026-11-26T21:30:00Z')""")
    conn.commit()

    def fetch(url, params=None, timeout=None):
        if url.endswith("scoreboard"):
            return _Resp({"events": [{"id": "501", "date": "2026-11-26T21:30Z",
                                      "status": {"type": {"name": "STATUS_FINAL"}}}]})
        return _Resp(_nfl_summary())
    return collect_boxscores(conn, ["americanfootball_nfl"], [date(2026, 11, 26)], fetch=fetch, sleep=NO_SLEEP)


def test_collect_nfl_boxscores_links_fixture(conn):
    res = _seed_nfl(conn)
    assert res["americanfootball_nfl"] == {"final_games": 1, "new_games": 1, "linked": 1, "players": 5, "status": "ok"}
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM multisport_nfl_player_stats WHERE event_id = 'nfl-ev'")
        assert cur.fetchone()[0] == 5


def _prop(cur, book, market, player, line, over, under):
    cur.execute("""INSERT INTO multisport_player_props (sport_key, event_id, commence_time, home_team, away_team,
                       bookmaker, market, player_name, line, over_price, under_price, ts_recorded)
                   VALUES ('americanfootball_nfl', 'nfl-ev', '2026-11-26T21:30:00Z', 'Dallas Cowboys',
                           'Philadelphia Eagles', %s, %s, %s, %s, %s, %s, '2026-11-26T20:30:00Z')""",
                (book, market, player, line, over, under))


def test_grade_nfl_props_two_sided_yes_only_and_void(conn):
    _seed_nfl(conn)
    with conn.cursor() as cur:
        for book in ("a", "b"):
            _prop(cur, book, "player_reception_yds", "CeeDee Lamb", 79.5, 1.87, 1.93)
            _prop(cur, book, "player_pass_yds", "Dak Prescott", 270.5, 1.90, 1.90)
        _prop(cur, "a", "player_anytime_td", "Javonte Williams", 0.5, 2.10, None)   # Yes-only
        _prop(cur, "b", "player_anytime_td", "Javonte Williams", 0.5, 2.00, None)
        _prop(cur, "a", "player_anytime_td", "CeeDee Lamb", 0.5, 2.20, 1.65)       # two-sided
        _prop(cur, "a", "player_receptions", "Jake Ferguson", 4.5, 1.90, 1.90)     # did not play
    conn.commit()
    out = prop_results.report(conn, now=datetime(2026, 11, 27, 6, tzinfo=timezone.utc))
    assert out["graded"] == 4 and out["void"] == 1
    with conn.cursor() as cur:
        cur.execute("""SELECT market, player_name, actual::float, result, under_prob IS NULL, over_prob::float
                         FROM multisport_prop_results ORDER BY market, player_name""")
        rows = {(m, p): (a, r, yes_only, op) for m, p, a, r, yes_only, op in cur.fetchall()}
    assert rows[("player_reception_yds", "CeeDee Lamb")][:2] == (104.0, "over")
    assert rows[("player_pass_yds", "Dak Prescott")][:2] == (268.0, "under")
    a, r, yes_only, op = rows[("player_anytime_td", "Javonte Williams")]
    assert (a, r, yes_only) == (1.0, "over", True) and abs(op - (1 / 2.10 + 1 / 2.00) / 2) < 1e-3
    assert rows[("player_anytime_td", "CeeDee Lamb")][1:3] == ("over", False)
    assert rows[("player_receptions", "Jake Ferguson")][1] == "void"
    assert "anytime_td (yes-only, margin included)" in out["calibration_main_lines"]


def test_grade_nfl_prop_flag(conn):
    _seed_nfl(conn)
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO multisport_prop_flags (sport_key, event_id, commence_time, home_team, away_team,
                           bookmaker, market, player_name, line, side, price, fair_prob, edge, n_books, ts_recorded)
                       VALUES ('americanfootball_nfl', 'nfl-ev', '2026-11-26T21:30:00Z', 'Dallas Cowboys',
                               'Philadelphia Eagles', 'x', 'player_rush_yds', 'Javonte Williams', 74.5, 'under', 2.1,
                               0.5, 0.05, 4, '2026-11-26T20:30:00Z')""")
    conn.commit()
    assert prop_shop.grade(conn, now=datetime(2026, 11, 27, 6, tzinfo=timezone.utc))["graded"] == 1
    with conn.cursor() as cur:
        cur.execute("SELECT actual::float, won FROM multisport_prop_flags")
        assert cur.fetchone() == (91.0, False)
