"""Command line entry point. Every job is one subcommand so GitHub Actions and a
laptop run exactly the same code:

  snapbet-pipeline migrate
  snapbet-pipeline collect            # odds -> fixtures + snapshots (hourly)
  snapbet-pipeline results [--days N] # scores -> results, fixtures (hourly)
  snapbet-pipeline sync               # finished games -> training rows + features
  snapbet-pipeline train [--force]    # policy-gated per-sport LightGBM
  snapbet-pipeline predict            # upcoming fixtures -> MultisportMatch
  snapbet-pipeline settle             # finals -> MultisportMatch.finalResult
  snapbet-pipeline run                # collect + results + sync + predict + settle
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
from typing import Dict

from . import db
from .collect import collect_odds
from .import_csv import import_csv_file
from .ledger import settle_ledger, track_record
from .config import SPORTS, Settings
from .odds_api import OddsApiClient
from .predict import Predictor, predict_upcoming
from .publish import publish_predictions, settle_finished
from .results import collect_results
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
    return collect_odds(conn, _client(s), s.sports, respect_season=not args.ignore_season)


def cmd_results(conn, s: Settings, args) -> Dict:
    return collect_results(conn, _client(s), s.sports, days_from=args.days,
                           respect_season=not args.ignore_season)


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


def cmd_run(conn, s: Settings, args) -> Dict:
    out: Dict = {}
    out["collect"] = _job(conn, "collect", lambda: cmd_collect(conn, s, args))
    out["results"] = _job(conn, "results", lambda: cmd_results(conn, s, args))
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


COMMANDS = {"migrate": cmd_migrate, "collect": cmd_collect, "results": cmd_results, "sync": cmd_sync,
            "train": cmd_train, "predict": cmd_predict, "settle": cmd_settle, "run": cmd_run,
            "status": cmd_status, "import-csv": cmd_import_csv, "report": cmd_report,
            "import-odds-api-history": cmd_import_odds_api_history}


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="snapbet-pipeline", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("command", choices=sorted(COMMANDS))
    p.add_argument("--days", type=int, default=None, help="results: lookback window (steps down to plan limit)")
    p.add_argument("--force", action="store_true", help="train: ignore the retrain policy")
    p.add_argument("--dry-run", action="store_true", help="train: only report the policy decision")
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
    p.add_argument("--cache-dir", default=None, help="import-odds-api-history: reuse/save raw API responses here")
    p.add_argument("--supersede-csv", action="store_true",
                   help="import-odds-api-history: delete earlier csv- imports of the same games")
    p.add_argument("-v", "--verbose", action="store_true")
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    s = Settings.from_env()
    if args.sports:
        s.sports = [x.strip() for x in args.sports.split(",") if x.strip()]
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
