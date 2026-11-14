"""AI researcher: a Claude forecast per game, logged next to the market price (paper only).

For each game starting WINDOW_MIN..WINDOW_MAX from now that has no forecast yet,
we assemble a brief from our own tables (book consensus and its movement, Kalshi,
ESPN injury reports, schedule fatigue, recent form, head-to-head, NBA player
averages), give Claude web search for late news, and ask it to call
`submit_forecast` with a home-win probability. `score` compares the forecasts
with the market on finished games.

Nothing here places bets or publishes picks.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional

logger = logging.getLogger(__name__)

MODEL = "claude-opus-5-5"
WINDOW_MIN = timedelta(minutes=45)
WINDOW_MAX = timedelta(minutes=180)
MAX_SEARCHES = 4
MAX_CONTINUATIONS = 3
# USD per 1M tokens / per search, for the logged cost estimate (Opus 5.5 list prices)
PRICE_IN, PRICE_OUT, PRICE_SEARCH = 4.0, 20.0, 0.01

SYSTEM = """You are a sports betting research analyst producing a calibrated pre-game win probability.

You get a brief built from our database: the betting market's current price and how it moved, prediction-market (Kalshi) prices, the official injury report, schedule fatigue, recent form, head-to-head, and (NBA) player averages. You may run a few web searches for late news the brief may miss: confirmed lineups, late scratches, rest days for stars, goalie starts (NHL), weather (NFL outdoor), travel problems.

How to think about it:
- The market price is an excellent forecast that already reflects public information, including most injuries and schedule spots. Start from it.
- Move away from it only for a specific, concrete reason you can name, ideally news that appears to postdate the market's last move. Fatigue, form, and head-to-head records are usually already priced; treat them as weak evidence.
- Most of the time your probability should be within a few points of the market. Being honest that you have no edge is the right answer when you don't.
- Note the date and time of any news you rely on, and say if you could not confirm something.

When you are done, call submit_forecast exactly once."""

FORECAST_TOOL = {
    "name": "submit_forecast",
    "description": "Record the final pre-game forecast. Call exactly once, after any research.",
    "strict": True,
    "input_schema": {
        "type": "object",
        "properties": {
            "prob_home": {"type": "number", "description": "Probability the HOME team wins, 0.01-0.99."},
            "confidence": {"type": "string", "enum": ["low", "medium", "high"],
                           "description": "How confident you are that this differs usefully from the market."},
            "key_factors": {"type": "array", "items": {
                "type": "object",
                "properties": {"factor": {"type": "string"},
                               "favours": {"type": "string", "enum": ["home", "away", "neither"]},
                               "weight": {"type": "string", "enum": ["minor", "moderate", "major"]}},
                "required": ["factor", "favours", "weight"], "additionalProperties": False}},
            "news_found": {"type": "string", "description": "Late news from search with timestamps, or 'none'."},
            "reasoning": {"type": "string", "description": "Three to six sentences."},
        },
        "required": ["prob_home", "confidence", "key_factors", "news_found", "reasoning"],
        "additionalProperties": False,
    },
}
WEB_SEARCH = {"type": "web_search_20260209", "name": "web_search", "max_uses": MAX_SEARCHES}


def _devig(h, a) -> Optional[float]:
    if not h or not a:
        return None
    ph, pa = 1 / float(h), 1 / float(a)
    return round(ph / (ph + pa), 4)


def due_games(cur, sport_keys: List[str], now: datetime, model: str = MODEL) -> List[tuple]:
    cur.execute("""
        SELECT f.sport_key, f.event_id, f.home_team, f.away_team, f.commence_time
          FROM multisport_fixtures f
         WHERE f.sport_key = ANY(%s) AND f.status <> 'finished'
           AND f.commence_time BETWEEN %s AND %s
           AND NOT EXISTS (SELECT 1 FROM multisport_ai_forecasts a WHERE a.event_id = f.event_id AND a.model = %s)
         ORDER BY f.commence_time""",
        (list(sport_keys), now + WINDOW_MIN, now + WINDOW_MAX, model))
    return cur.fetchall()


def _aliases(cur, sport_key: str, team: str) -> List[str]:
    """Every spelling of `team` in our tables (e.g. 'Montréal' vs 'Montreal')."""
    from .espn_scores import _loose
    cur.execute("""SELECT home_team FROM multisport_fixtures WHERE sport_key=%s
                   UNION SELECT away_team FROM multisport_fixtures WHERE sport_key=%s
                   UNION SELECT team FROM multisport_injuries WHERE sport_key=%s""", (sport_key, sport_key, sport_key))
    key = _loose(team)
    return sorted({team} | {r[0] for r in cur.fetchall() if r[0] and _loose(r[0]) == key})


def build_brief(cur, sport_key: str, event_id: str, home: str, away: str, start: datetime, now: datetime) -> Dict:
    names = {home: _aliases(cur, sport_key, home), away: _aliases(cur, sport_key, away)}
    b: Dict = {"sport": sport_key, "home_team": home, "away_team": away,
               "start_utc": start.isoformat(), "brief_built_utc": now.isoformat()}
    # market: open, latest, number of books
    cur.execute("""SELECT ts_recorded, home_odds, away_odds, home_spread, total_line, n_bookmakers
                     FROM multisport_odds_snapshots WHERE event_id=%s AND is_consensus AND ts_recorded <= %s
                    ORDER BY ts_recorded""", (event_id, now))
    snaps = cur.fetchall()
    if snaps:
        o, l = snaps[0], snaps[-1]
        b["market"] = {"home_win_prob_now": _devig(l[1], l[2]), "home_win_prob_open": _devig(o[1], o[2]),
                       "home_spread_now": float(l[3]) if l[3] is not None else None,
                       "total_now": float(l[4]) if l[4] is not None else None,
                       "books": l[5], "last_update_utc": l[0].isoformat(), "snapshots": len(snaps)}
    cur.execute("""SELECT DISTINCT ON (team) team, yes_bid, yes_ask, volume, ts_recorded
                     FROM multisport_kalshi_snapshots
                    WHERE event_id=%s AND market_type='game' AND ts_recorded <= %s
                    ORDER BY team, ts_recorded DESC""", (event_id, now))
    k = {r[0]: r for r in cur.fetchall()}
    if home in k and k[home][1] is not None and k[home][2] is not None:
        b["kalshi"] = {"home_win_mid": round((float(k[home][1]) + float(k[home][2])) / 2, 3),
                       "volume_usd": float(k[home][3] or 0), "as_of_utc": k[home][4].isoformat()}
    # injuries listed in the last 6h
    cur.execute("""SELECT DISTINCT ON (player_id) team, player_name, position, status, fantasy_status,
                          injury_type, return_date, short_comment, report_time
                     FROM multisport_injuries
                    WHERE sport_key=%s AND team = ANY(%s) AND last_seen >= %s
                    ORDER BY player_id, last_seen DESC""", (sport_key, names[home] + names[away], now - timedelta(hours=6)))
    inj: Dict[str, List] = {home: [], away: []}
    for r in cur.fetchall():
        inj[home if r[0] in names[home] else away].append({"player": r[1], "pos": r[2], "status": r[3], "tag": r[4], "injury": r[5],
                                         "expected_return": r[6].isoformat() if r[6] else None,
                                         "note": r[7], "reported_utc": r[8].isoformat() if r[8] else None})
    b["injury_report"] = inj
    # schedule fatigue + form + h2h from finished fixtures
    for side, team in (("home", home), ("away", away)):
        cur.execute("""SELECT commence_time, home_team, away_team, home_score, away_score
                         FROM multisport_fixtures
                        WHERE sport_key=%s AND (home_team = ANY(%s) OR away_team = ANY(%s)) AND commence_time < %s
                          AND status='finished' ORDER BY commence_time DESC LIMIT 10""",
                    (sport_key, names[team], names[team], start - timedelta(hours=2)))
        rows = cur.fetchall()
        res = []
        for t, h, a, hs, as_ in rows:
            at_home = h in names[team]
            won = (hs > as_) if at_home else (as_ > hs)
            res.append({"date": t.date().isoformat(), "opp": a if at_home else h, "venue": "home" if at_home else "away",
                        "score": f"{hs}-{as_}" if at_home else f"{as_}-{hs}", "won": won})
        days = [(start - t).total_seconds() / 86400 for t, *_ in rows]
        venues = [r["venue"] for r in res]
        if sport_key == "basketball_nba":           # box scores hold every game, fixtures only priced ones
            cur.execute("""SELECT DISTINCT espn_event_id, game_time, is_home FROM multisport_player_boxscores
                            WHERE sport_key='basketball_nba' AND team = ANY(%s) AND game_time < %s
                              AND game_time > %s ORDER BY game_time DESC""",
                        (names[team], start - timedelta(hours=2), start - timedelta(days=21)))
            games = cur.fetchall()
            if games:
                days = [(start - t).total_seconds() / 86400 for _, t, _ in games]
                venues = ["home" if h else "away" for *_, h in games]
        road = 0
        for v in venues:
            if v == "away":
                road += 1
            else:
                break
        b[f"{side}_schedule"] = {"days_since_last_game": round(days[0], 1) if days else None,
                                 "games_in_previous_4_days": sum(1 for d in days if d <= 4),
                                 "games_in_previous_7_days": sum(1 for d in days if d <= 7),
                                 "consecutive_road_games_before_this": road}
        b[f"{side}_last_10"] = res
    cur.execute("""SELECT commence_time::date, home_team, home_score, away_score FROM multisport_fixtures
                    WHERE sport_key=%s AND status='finished' AND commence_time < %s
                      AND ((home_team = ANY(%s) AND away_team = ANY(%s)) OR (home_team = ANY(%s) AND away_team = ANY(%s)))
                    ORDER BY commence_time DESC LIMIT 5""", (sport_key, start, names[home], names[away], names[away], names[home]))
    b["head_to_head"] = [{"date": d.isoformat(), "home": h, "score": f"{hs}-{as_}"} for d, h, hs, as_ in cur.fetchall()]
    if sport_key == "basketball_nba":
        cur.execute("""SELECT team, player_name, COUNT(*) FILTER (WHERE NOT did_not_play) gp,
                              ROUND(AVG(minutes) FILTER (WHERE NOT did_not_play), 1) mpg,
                              ROUND(AVG(points) FILTER (WHERE NOT did_not_play), 1) ppg
                         FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY team, player_id ORDER BY game_time DESC) rn
                                 FROM multisport_player_boxscores
                                WHERE sport_key='basketball_nba' AND team = ANY(%s) AND game_time < %s) x
                        WHERE rn <= 10 GROUP BY team, player_name
                       HAVING AVG(minutes) FILTER (WHERE NOT did_not_play) >= 15
                        ORDER BY team, mpg DESC""", (names[home] + names[away], start))
        b["rotation_last_10_games"] = [{"team": t, "player": p, "games": g, "mpg": float(m), "ppg": float(pp)}
                                       for t, p, g, m, pp in cur.fetchall()]
    return b


def _forecast(client, brief: Dict, model: str) -> Dict:
    """One game -> submit_forecast input + usage. Handles pause_turn; returns {} if no forecast."""
    user = ("Forecast this game. The brief is JSON from our database; times are UTC.\n\n"
            + json.dumps(brief, default=str, indent=1))
    messages: List[Dict] = [{"role": "user", "content": user}]
    usage = {"input_tokens": 0, "output_tokens": 0, "web_searches": 0}
    for _ in range(MAX_CONTINUATIONS + 1):
        resp = client.beta.messages.create(
            model=model, max_tokens=16000, system=SYSTEM, messages=messages,
            tools=[WEB_SEARCH, FORECAST_TOOL], tool_choice={"type": "auto"},
            output_config={"effort": "medium"},
            betas=["server-side-fallback-2026-07-01"], fallbacks="default")
        usage["input_tokens"] += resp.usage.input_tokens + (resp.usage.cache_read_input_tokens or 0)
        usage["output_tokens"] += resp.usage.output_tokens
        stu = getattr(resp.usage, "server_tool_use", None)
        usage["web_searches"] += (getattr(stu, "web_search_requests", 0) or 0) if stu else 0
        for block in resp.content:
            if block.type == "tool_use" and block.name == "submit_forecast":
                return {"forecast": dict(block.input), "usage": usage, "model": resp.model}
        if resp.stop_reason == "pause_turn":
            messages = [messages[0], {"role": "assistant", "content": resp.content}]
            continue
        if resp.stop_reason == "refusal":
            logger.warning("forecast refused: %s", getattr(resp, "stop_details", None))
            return {"usage": usage}
        # finished without calling the tool: ask once more, explicitly
        messages = [messages[0], {"role": "assistant", "content": resp.content},
                    {"role": "user", "content": "Please call submit_forecast now with your final numbers."}]
    return {"usage": usage}


def research(conn, sport_keys: Iterable[str], now: Optional[datetime] = None, max_games: int = 12,
             dry_run: bool = False, client=None, model: str = MODEL) -> Dict:
    now = now or datetime.now(timezone.utc)
    out: Dict = {"due": 0, "forecast": 0, "failed": 0, "cost_usd_est": 0.0, "games": []}
    with conn.cursor() as cur:
        games = due_games(cur, list(sport_keys), now, model)
    out["due"] = len(games)
    if not games:
        return out
    if not dry_run and client is None:
        import anthropic
        client = anthropic.Anthropic()
    for sport_key, event_id, home, away, start in games[:max_games]:
        with conn.cursor() as cur:
            brief = build_brief(cur, sport_key, event_id, home, away, start, now)
        if dry_run:
            out["games"].append({"game": f"{away} at {home}", "brief": brief})
            continue
        try:
            r = _forecast(client, brief, model)
        except Exception as e:                      # one bad game must not stop the rest
            logger.error("forecast %s failed: %s", event_id, e)
            out["failed"] += 1
            continue
        u = r["usage"]
        cost = (u["input_tokens"] * PRICE_IN + u["output_tokens"] * PRICE_OUT) / 1e6 + u["web_searches"] * PRICE_SEARCH
        out["cost_usd_est"] += cost
        f = r.get("forecast")
        if not f:
            out["failed"] += 1
            continue
        p = min(max(float(f["prob_home"]), 0.01), 0.99)
        mkt = (brief.get("market") or {}).get("home_win_prob_now")
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO multisport_ai_forecasts (sport_key, event_id, commence_time, home_team, away_team, model,
                    prob_home, confidence, key_factors, news_found, reasoning, market_prob_home, kalshi_prob_home,
                    brief, web_searches, input_tokens, output_tokens, cost_usd_est, ts_recorded)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (event_id, model) DO NOTHING""",
                (sport_key, event_id, start, home, away, model, p, f.get("confidence"),
                 json.dumps(f.get("key_factors")), f.get("news_found"), f.get("reasoning"), mkt,
                 (brief.get("kalshi") or {}).get("home_win_mid"), json.dumps(brief, default=str),
                 u["web_searches"], u["input_tokens"], u["output_tokens"], round(cost, 4), now))
        conn.commit()
        out["forecast"] += 1
        out["games"].append({"game": f"{away} at {home}", "ai": round(p, 3), "market": mkt,
                             "confidence": f.get("confidence"), "cost": round(cost, 3)})
    out["cost_usd_est"] = round(out["cost_usd_est"], 3)
    return out


def score(conn, model: str = MODEL) -> Dict:
    """Finished games: AI vs market-at-forecast-time vs closing line (log loss, lower is better)."""
    import math
    with conn.cursor() as cur:
        cur.execute("""
            SELECT a.sport_key, a.prob_home, a.market_prob_home, f.outcome, a.confidence,
                   (SELECT 1/o.home_odds/(1/o.home_odds+1/o.away_odds) FROM multisport_odds_snapshots o
                     WHERE o.event_id=a.event_id AND o.is_consensus AND o.ts_recorded <= f.commence_time
                     ORDER BY o.ts_recorded DESC LIMIT 1), a.cost_usd_est
              FROM multisport_ai_forecasts a JOIN multisport_fixtures f ON f.event_id=a.event_id
             WHERE a.model=%s AND f.status='finished' AND f.outcome IN ('H','A')""", (model,))
        rows = cur.fetchall()
    ll = lambda p, y: -math.log(min(max(float(p), 1e-4), 1 - 1e-4) if y else 1 - min(max(float(p), 1e-4), 1 - 1e-4))
    out: Dict = {}
    for sport in sorted({r[0] for r in rows}) + ["all"]:
        rs = [r for r in rows if sport == "all" or r[0] == sport]
        rs = [r for r in rs if r[2] is not None and r[5] is not None]
        if not rs:
            continue
        y = [r[3] == "H" for r in rs]
        out[sport] = {"games": len(rs),
                      "logloss_ai": round(sum(ll(r[1], yy) for r, yy in zip(rs, y)) / len(rs), 4),
                      "logloss_market_at_forecast": round(sum(ll(r[2], yy) for r, yy in zip(rs, y)) / len(rs), 4),
                      "logloss_closing": round(sum(ll(r[5], yy) for r, yy in zip(rs, y)) / len(rs), 4),
                      "avg_gap_from_market_pts": round(100 * sum(abs(float(r[1]) - float(r[2])) for r in rs) / len(rs), 2),
                      "spent_usd": round(sum(float(r[6] or 0) for r in rs), 2)}
    return out
