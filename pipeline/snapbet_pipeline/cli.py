"""Command line entry point. Every job is one subcommand so GitHub Actions and a
laptop run exactly the same code:

  snapbet-pipeline migrate
  snapbet-pipeline collect            # odds -> fixtures + snapshots (hourly)
  snapbet-pipeline results [--days N] # ESPN finals (free); Odds API only as fallback, or with --days / --odds-api-scores
  snapbet-pipeline sync               # finished games -> training rows + features
  snapbet-pipeline train [--force]    # policy-gated per-sport LightGBM
  snapbet-pipeline predict            # upcoming fixtures -> MultisportMatch
  snapbet-pipeline settle             # finals -> MultisportMatch.finalResult
  snapbet-pipeline kalshi             # Kalshi game-winner prices -> kalshi snapshots (public, no credits)
  snapbet-pipeline research [--dry-run] [--max-games N]  # AI researcher: Claude forecast per game 45-180 min out (paper only)
  snapbet-pipeline research-score     # AI forecasts vs market log loss on finished games
  snapbet-pipeline injuries           # ESPN injury reports, status history (free)
  snapbet-pipeline run                # collect (or a near-close re-pull) + kalshi + props + regulation + injuries
                                      #   + results + boxscores + sync + predict + settle
  snapbet-pipeline regulation         # NHL regulation-time 3-way odds, each game once <60 min before puck drop (1 credit/game)
  snapbet-pipeline picks [--date D] [--min-prob 0.70] [--max-picks 5] [--out FILE]
                                      # paper picks: strongest favourites >= min-prob, every sport on one scale
  snapbet-pipeline props              # NBA player props, each game once ~30-90 min before tip (4 credits/game)
  snapbet-pipeline prop-flags         # line shopping: props where one book beats the others' fair price; graded record
  snapbet-pipeline prop-results       # every prop line graded (no-vig over/under, best prices, result) + calibration
  snapbet-pipeline boxscores [--from D --to D]  # ESPN player box scores (free); default: last 2 ET days
  snapbet-pipeline prune [--keep-days 7] [--dry-run]
                                      # thin per-book/Kalshi snapshots of old games (consensus kept)
  snapbet-pipeline status             # row counts + last runs
  snapbet-pipeline report             # settled track record per sport (hit rate, value-bet ROI, CLV)
  snapbet-pipeline import-csv --sports americanfootball_nfl --file games.csv [--source name]
                                      # cold-start: finished games (+closing odds) from a CSV
  snapbet-pipeline import-odds-api-history --sports basketball_nba --from 2026-01-01 --to 2026-03-19
                                      [--offsets 1] [--max-credits N] [--cache-dir D] [--supersede-csv] [--dry-run]
                                      # past seasons: real Odds API events + every book + ESPN scores
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Dict, Optional

from . import db
from .collect import collect_odds
from .closing import collect_regulation, sports_needing_close
from . import picks as picks_mod
from .import_csv import import_csv_file
from .kalshi import collect_kalshi
from .ledger import settle_ledger, track_record
from .config import SPORTS, Settings, collect_sports
from .odds_api import OddsApiClient
from .predict import Predictor, predict_upcoming
from .publish import publish_predictions, settle_finished
from .results import collect_results
from .espn_scores import collect_results_espn
from .retention import prune
from .props import collect_props
from . import prop_shop
from . import prop_results
from .boxscores import collect_boxscores, recent_days
from .injuries import collect_injuries
from .train import should_train, train_sport
from .training_sync import sync_training

logger = logging.getLogger("snapbet_pipeline")


def _client(s: Settings) -> OddsApiClient:
    return OddsApiClient(s.odds_api_key, base_url=s.odds_api_base_url)


def _job(conn, name: str, fn) -> Dict:
    started = datetime.now(timezone.utc)
    try:
        result = fn()
        db.log_run(conn, name, "ok", started, metrics=result)
        return result
    except Exception as e:
        conn.rollback()
        db.log_run(conn, name, "error", started, error=str(e))
        raise


def cmd_migrate(conn, s: Settings, args) -> Dict:
    return {"applied": db.migrate(conn)}


def cmd_collect(conn, s: Settings, args) -> Dict:
    return collect_odds(conn, _client(s), collect_sports(s), respect_season=not args.ignore_season)


def cmd_kalshi(conn, s: Settings, args) -> Dict:
    return collect_kalshi(conn, collect_sports(s))


def cmd_results(conn, s: Settings, args) -> Dict:
    if args.odds_api_scores or args.days:
        return collect_results(conn, _client(s), collect_sports(s), days_from=args.days,
                               respect_season=not args.ignore_season)
    return collect_results_espn(conn, _client(s), collect_sports(s), respect_season=not args.ignore_season)


def cmd_sync(conn, s: Settings, args) -> Dict:
    return {k: sync_training(conn, k) for k in s.sports}


def cmd_train(conn, s: Settings, args) -> Dict:
    out = {}
    for k in s.sports:
        if args.dry_run:
            ok, reason = should_train(conn, k, s.models_dir)
            out[k] = {"would_train": ok, "reason": reason}
        else:
            out[k] = train_sport(conn, k, s.models_dir, force=args.force)
    return out


def cmd_predict(conn, s: Settings, args) -> Dict:
    out = {}
    for k in s.sports:
        predictor = Predictor.load(s.models_dir, k, conn)
        preds = predict_upcoming(conn, k, predictor)
        res = publish_predictions(conn, preds)
        res.update(mode=("cold_start_market_only" if predictor is None
                         else "market_only_model_adds_nothing" if predictor.is_market_only else "model"),
                   edge_validated=bool(predictor and predictor.edge_validated),
                   anchor_rounds=(predictor.metadata.get("anchor_rounds") if predictor else None),
                   with_value_bet=sum(1 for p in preds if (p.prediction_data.get("value") or {}).get("value_bet")))
        out[k] = res
    return out


def cmd_settle(conn, s: Settings, args) -> Dict:
    return {k: {"matches": settle_finished(conn, k), "ledger": settle_ledger(conn, k)} for k in s.sports}


def cmd_report(conn, s: Settings, args) -> Dict:
    """Settled track record per sport (90d) straight from the pick ledger."""
    out = {}
    with conn.cursor() as cur:
        for k in s.sports:
            rec = track_record(conn, k)
            cur.execute("""SELECT COUNT(*) FILTER (WHERE settled_at IS NULL),
                                  COUNT(*) FILTER (WHERE settled_at IS NULL AND value_bet_outcome IS NOT NULL),
                                  COUNT(*) FILTER (WHERE settled_at IS NOT NULL AND closing_method = 'latest_available')
                             FROM multisport_pick_ledger WHERE sport_key = %s""", (k,))
            open_rows, open_vb, no_pre_close = cur.fetchone()
            rec.update(open_picks=open_rows, open_value_bets=open_vb, settled_without_pre_close_snapshot=no_pre_close)
            out[k] = rec
    return out


def cmd_props(conn, s: Settings, args) -> Dict:
    return collect_props(conn, _client(s), collect_sports(s), max_credits=args.max_credits)


def cmd_regulation(conn, s: Settings, args) -> Dict:
    return collect_regulation(conn, _client(s), s.sports)


def cmd_picks(conn, s: Settings, args) -> Dict:
    day = picks_mod.parse_day(args.date)
    out = picks_mod.build_picks(conn, s.sports, day, n=args.max_picks, min_prob=args.min_prob)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(out, f, indent=2)
            f.write("\n")
    return out


def cmd_prop_flags(conn, s: Settings, args) -> Dict:
    return prop_shop.report(conn)


def cmd_prop_results(conn, s: Settings, args) -> Dict:
    return prop_results.report(conn)


def cmd_boxscores(conn, s: Settings, args) -> Dict:
    from datetime import date, timedelta
    if args.date_from:
        start = date.fromisoformat(args.date_from)
        end = date.fromisoformat(args.date_to) if args.date_to else start
        days = [start + timedelta(days=i) for i in range((end - start).days + 1)]
    else:
        days = recent_days()
    return collect_boxscores(conn, collect_sports(s), days)


def cmd_injuries(conn, s: Settings, args) -> Dict:
    return collect_injuries(conn, s.sports)


def cmd_research(conn, s: Settings, args) -> Dict:
    import os
    from .ai_research import research
    if not args.dry_run and not (os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN")):
        return {"status": "skipped", "reason": "ANTHROPIC_API_KEY not set"}
    return research(conn, s.sports, max_games=args.max_games, dry_run=args.dry_run)


def cmd_research_score(conn, s: Settings, args) -> Dict:
    from .ai_research import score
    return score(conn)


def cmd_prune(conn, s: Settings, args) -> Dict:
    return prune(conn, keep_days=args.keep_days, dry_run=args.dry_run)


def minutes_since_last_odds(conn) -> Optional[float]:
    with conn.cursor() as cur:
        cur.execute("SELECT EXTRACT(EPOCH FROM now() - MAX(ts_recorded)) / 60 FROM multisport_odds_snapshots")
        v = cur.fetchone()[0]
    return float(v) if v is not None else None


def cmd_run(conn, s: Settings, args) -> Dict:
    out: Dict = {}
    # Several triggers may fire in one hour (three cron slots an hour because GitHub drops many scheduled runs);
    # only the first one spends Odds API credits on odds.
    # Between hourly pulls, a sport with a game starting within 45 minutes whose odds are 20+ minutes old is
    # re-pulled on its own, so the last pre-game snapshot is a real closing price.
    age = minutes_since_last_odds(conn)
    if age is not None and age < args.min_collect_gap:
        close = sports_needing_close(conn, s.sports)
        if close:
            out["collect"] = _job(conn, "collect_close",
                                  lambda: collect_odds(conn, _client(s), close, respect_season=not args.ignore_season))
            out["collect"]["mode"] = "close"
        else:
            out["collect"] = {"status": "skipped", "reason": f"odds collected {age:.0f} min ago"}
    else:
        out["collect"] = _job(conn, "collect", lambda: cmd_collect(conn, s, args))
    # research captures; never block the publishing jobs
    for name, fn in (("kalshi", cmd_kalshi), ("props", cmd_props), ("regulation", cmd_regulation),
                     ("injuries", cmd_injuries)):
        try:
            out[name] = _job(conn, name, lambda fn=fn: fn(conn, s, args))
        except Exception as e:
            out[name] = {"status": "error", "error": str(e)}
    out["results"] = _job(conn, "results", lambda: cmd_results(conn, s, args))
    try:
        out["boxscores"] = _job(conn, "boxscores", lambda: cmd_boxscores(conn, s, args))
    except Exception as e:
        out["boxscores"] = {"status": "error", "error": str(e)}
    try:
        out["prop_flags"] = _job(conn, "prop_flags", lambda: prop_shop.grade(conn))
    except Exception as e:
        out["prop_flags"] = {"status": "error", "error": str(e)}
    try:
        out["prop_results"] = _job(conn, "prop_results", lambda: prop_results.refresh(conn))
    except Exception as e:
        out["prop_results"] = {"status": "error", "error": str(e)}
    out["sync"] = _job(conn, "sync", lambda: cmd_sync(conn, s, args))
    out["predict"] = _job(conn, "predict", lambda: cmd_predict(conn, s, args))
    out["settle"] = _job(conn, "settle", lambda: cmd_settle(conn, s, args))
    return out


def cmd_import_csv(conn, s: Settings, args) -> Dict:
    if not args.file:
        raise SystemExit("import-csv needs --file <path.csv>")
    if len(s.sports) != 1:
        raise SystemExit("import-csv needs exactly one sport: --sports <sport_key>")
    team_map = None
    if args.team_map:
        with open(args.team_map, "r", encoding="utf-8") as f:
            team_map = json.load(f)
    return import_csv_file(conn, s.sports[0], args.file, source=args.source, team_map=team_map,
                           dry_run=args.dry_run, default_hour_utc=args.default_hour)


def cmd_import_odds_api_history(conn, s: Settings, args) -> Dict:
    from datetime import date
    from .history import import_history
    from .odds_api import OddsApiClient
    if len(s.sports) != 1:
        raise SystemExit("import-odds-api-history needs exactly one sport: --sports <sport_key>")
    if not (args.date_from and args.date_to):
        raise SystemExit("import-odds-api-history needs --from YYYY-MM-DD --to YYYY-MM-DD")
    team_map = None
    if args.team_map:
        with open(args.team_map, "r", encoding="utf-8") as f:
            team_map = json.load(f)
    client = None if args.dry_run else OddsApiClient(s.odds_api_key, base_url=s.odds_api_base_url)
    offsets = [float(x) for x in (args.offsets or "1").split(",") if x.strip()]
    return import_history(conn, client, s.sports[0], date.fromisoformat(args.date_from),
                          date.fromisoformat(args.date_to), offsets_hours=offsets, max_credits=args.max_credits,
                          cache_dir=args.cache_dir, dry_run=args.dry_run, supersede=args.supersede_csv,
                          team_map=team_map)


def cmd_status(conn, s: Settings, args) -> Dict:
    out: Dict = {"sports": {}}
    with conn.cursor() as cur:
        for k in s.sports:
            cur.execute("""SELECT
                 (SELECT COUNT(*) FROM multisport_fixtures WHERE sport_key=%s AND status='scheduled' AND commence_time>NOW()),
                 (SELECT COUNT(*) FROM multisport_fixtures WHERE sport_key=%s AND status='finished'),
                 (SELECT COUNT(*) FROM multisport_odds_snapshots WHERE sport_key=%s),
                 (SELECT MAX(ts_recorded) FROM multisport_odds_snapshots WHERE sport_key=%s),
                 (SELECT COUNT(*) FROM multisport_training WHERE sport_key=%s AND features IS NOT NULL)""",
                        (k, k, k, k, k))
            up, fin, snaps, last, train = cur.fetchone()
            ok, reason = should_train(conn, k, s.models_dir)
            out["sports"][k] = {"upcoming": up, "finished": fin, "snapshots": snaps,
                                "last_snapshot": last.isoformat() if last else None,
                                "training_rows": train, "model": Predictor.load(s.models_dir, k, conn) is not None,
                                "train_policy": reason}
        cur.execute("""SELECT DISTINCT ON (job) job, status, finished_at, error
                         FROM multisport_pipeline_runs ORDER BY job, finished_at DESC""")
        out["last_runs"] = [{"job": j, "status": st, "finished_at": f.isoformat(), "error": e}
                            for j, st, f, e in cur.fetchall()]
    return out


COMMANDS = {"migrate": cmd_migrate, "collect": cmd_collect, "kalshi": cmd_kalshi, "results": cmd_results, "sync": cmd_sync,
            "train": cmd_train, "predict": cmd_predict, "settle": cmd_settle, "run": cmd_run,
            "status": cmd_status, "prune": cmd_prune, "props": cmd_props, "prop-flags": cmd_prop_flags, "prop-results": cmd_prop_results, "boxscores": cmd_boxscores, "injuries": cmd_injuries, "research": cmd_research, "regulation": cmd_regulation, "picks": cmd_picks, "research-score": cmd_research_score, "import-csv": cmd_import_csv, "report": cmd_report,
            "import-odds-api-history": cmd_import_odds_api_history}


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="snapbet-pipeline", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("command", choices=sorted(COMMANDS))
    p.add_argument("--days", type=int, default=None, help="results: lookback window (steps down to plan limit)")
    p.add_argument("--force", action="store_true", help="train: ignore the retrain policy")
    p.add_argument("--dry-run", action="store_true", help="train: only report the policy decision")
    p.add_argument("--odds-api-scores", action="store_true", help="results: use paid Odds API /scores instead of ESPN")
    p.add_argument("--ignore-season", action="store_true", help="collect/results: query off-season sports too")
    p.add_argument("--sports", default=None, help="comma-separated sport keys (overrides PIPELINE_SPORTS)")
    p.add_argument("--file", default=None, help="import-csv: path to the CSV file")
    p.add_argument("--source", default=None, help="import-csv: provenance label stored as bookmaker 'csv:<source>'")
    p.add_argument("--team-map", default=None, help="import-csv: JSON file {\"CSV label\": \"Canonical Team Name\"}")
    p.add_argument("--default-hour", type=int, default=23, help="import-csv: UTC hour for date-only rows (default 23)")
    p.add_argument("--from", dest="date_from", default=None, help="import-odds-api-history: first US date (YYYY-MM-DD)")
    p.add_argument("--to", dest="date_to", default=None, help="import-odds-api-history: last US date (YYYY-MM-DD)")
    p.add_argument("--offsets", default="1",
                   help="import-odds-api-history: hours before each day's first kickoff to snapshot, e.g. '24,1'")
    p.add_argument("--max-credits", type=int, default=None, help="import-odds-api-history: Odds API credit cap")
    p.add_argument("--min-collect-gap", type=float, default=50,
                   help="run: skip odds collection if odds were stored less than this many minutes ago")
    p.add_argument("--max-games", type=int, default=12, help="research: most games to forecast per run")
    p.add_argument("--cache-dir", default=None, help="import-odds-api-history: reuse/save raw API responses here")
    p.add_argument("--supersede-csv", action="store_true",
                   help="import-odds-api-history: delete earlier csv- imports of the same games")
    p.add_argument("--keep-days", type=int, default=7,
                   help="prune: keep every snapshot of games that started within this many days")
    p.add_argument("--date", default=None, help="picks: US/Eastern date YYYY-MM-DD (default today)")
    p.add_argument("--min-prob", type=float, default=picks_mod.MIN_PROB, help="picks: lowest win probability kept")
    p.add_argument("--max-picks", type=int, default=5, help="picks: most picks kept")
    p.add_argument("--out", default=None, help="picks: also write the picks JSON to this file")
    p.add_argument("-v", "--verbose", action="store_true")
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    s = Settings.from_env()
    if args.sports:
        s.sports = [x.strip() for x in args.sports.split(",") if x.strip()]
        s.research_sports = []  # an explicit --sports list is exactly what runs
        bad = [x for x in s.sports if x not in SPORTS]
        if bad:
            print(f"unknown sports: {bad}", file=sys.stderr)
            return 2
    with db.connection(s.database_url) as conn:
        if args.command != "migrate":
            db.migrate(conn)  # idempotent; keeps schema current on every run
        fn = COMMANDS[args.command]
        if args.command in ("run", "migrate", "status"):
            result = fn(conn, s, args)
        else:
            result = _job(conn, args.command, lambda: fn(conn, s, args))
    print(json.dumps(result, indent=2, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
