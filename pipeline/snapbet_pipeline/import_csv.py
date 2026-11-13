"""Cold-start accelerator: import finished games (and closing odds) from a CSV.

Why: the Replit database is gone, so every sport starts at zero training rows.
Waiting for live collection means ~3 weeks for NBA/NHL and most of the season
for NFL. A CSV of last season's results + closing lines gets `train` past its
minimum on day one.

What it writes (same tables the live collector uses, so sync/train need no
special casing):
  multisport_fixtures        status='finished', scores, outcome, league_name
  multisport_match_results   one row per game
  multisport_odds_snapshots  ONE consensus snapshot per game at commence_time − 1h
                             (bookmaker 'csv:<source>') when the row carries odds
  multisport_schedule        status='final'

Honesty notes written into every imported row's provenance:
  * event_id is synthetic: 'csv:<sport>:<yyyy-mm-dd>:<home>:<away>' (sha1-shortened),
    so re-importing is idempotent and the rows are distinguishable from live ones.
  * Imported games have a single snapshot → opening == closing, zero drift,
    n_snapshots = 1. Models trained on them see less line-movement signal than
    live-collected games. metadata.json records how many training rows came
    from CSV so this is visible.
  * Rows without a moneyline still import (they feed ELO / form / H2H features)
    but cannot become training rows (no market probability to learn against).

CSV columns (case-insensitive; aliases accepted, see COLUMN_ALIASES):
  date | commence_time        game date (YYYY-MM-DD) or ISO datetime
  home_team, away_team
  home_score, away_score
  [home_odds, away_odds]      decimal (1.57) or American (-175 / +145)
  [home_spread]               points, home perspective (-6.5)
  [total]                     over/under line
  [spread_home_odds, spread_away_odds, over_odds, under_odds]
  [neutral]                   ignored, accepted for compatibility
"""
from __future__ import annotations

import csv
import hashlib
import io
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional, Tuple

from .config import SPORTS, SportConfig
from .teams import canonical_team

logger = logging.getLogger(__name__)

COLUMN_ALIASES: Dict[str, Tuple[str, ...]] = {
    "date": ("date", "game_date", "commence_time", "datetime", "kickoff", "schedule_date", "gameday"),
    "home_team": ("home_team", "home", "team_home", "hometeam", "home_name"),
    "away_team": ("away_team", "away", "team_away", "awayteam", "away_name", "visitor", "visitor_team"),
    "home_score": ("home_score", "score_home", "home_pts", "home_points", "pts_home", "hscore"),
    "away_score": ("away_score", "score_away", "away_pts", "away_points", "pts_away", "ascore", "visitor_score"),
    "home_odds": ("home_odds", "home_ml", "ml_home", "home_moneyline", "moneyline_home", "home_close", "home_closing_odds"),
    "away_odds": ("away_odds", "away_ml", "ml_away", "away_moneyline", "moneyline_away", "away_close", "away_closing_odds"),
    "home_spread": ("home_spread", "spread", "spread_home", "home_line", "line", "closing_spread", "spread_favorite"),
    "total": ("total", "total_line", "over_under", "ou", "closing_total", "total_close"),
    "spread_home_odds": ("spread_home_odds", "home_spread_odds", "spread_odds_home"),
    "spread_away_odds": ("spread_away_odds", "away_spread_odds", "spread_odds_away"),
    "over_odds": ("over_odds", "odds_over", "over_price"),
    "under_odds": ("under_odds", "odds_under", "under_price"),
}

REQUIRED = ("date", "home_team", "away_team", "home_score", "away_score")


class CsvFormatError(ValueError):
    pass


@dataclass
class ImportedGame:
    event_id: str
    home_team: str
    away_team: str
    commence_time: datetime
    home_score: int
    away_score: int
    outcome: str                                  # 'H' | 'A'
    home_odds: Optional[float] = None
    away_odds: Optional[float] = None
    home_spread: Optional[float] = None
    total: Optional[float] = None
    spread_home_odds: Optional[float] = None
    spread_away_odds: Optional[float] = None
    over_odds: Optional[float] = None
    under_odds: Optional[float] = None

    @property
    def has_moneyline(self) -> bool:
        return bool(self.home_odds and self.away_odds and self.home_odds > 1 and self.away_odds > 1)


@dataclass
class ImportReport:
    source: str
    sport_key: str
    rows: int = 0
    parsed: int = 0
    with_odds: int = 0
    skipped: List[str] = field(default_factory=list)       # "line N: reason"
    unmapped_teams: Dict[str, int] = field(default_factory=dict)
    fixtures_new: int = 0
    fixtures_updated: int = 0
    snapshots: int = 0
    results: int = 0

    def summary(self) -> Dict:
        return {"source": self.source, "sport_key": self.sport_key, "rows": self.rows, "parsed": self.parsed,
                "with_odds": self.with_odds, "skipped": len(self.skipped), "skipped_examples": self.skipped[:10],
                "unmapped_teams": dict(sorted(self.unmapped_teams.items(), key=lambda kv: -kv[1])),
                "fixtures_new": self.fixtures_new, "fixtures_updated": self.fixtures_updated,
                "snapshots": self.snapshots, "results": self.results}


# ----------------------------------------------------------------------------- parsing
def _resolve_columns(header: Iterable[str]) -> Dict[str, str]:
    """Map our field names → actual header names present in the file."""
    norm = {h.strip().lower().replace(" ", "_"): h for h in header if h is not None}
    out: Dict[str, str] = {}
    for field_name, aliases in COLUMN_ALIASES.items():
        for a in aliases:
            if a in norm:
                out[field_name] = norm[a]
                break
    missing = [f for f in REQUIRED if f not in out]
    if missing:
        raise CsvFormatError(f"CSV is missing required columns {missing}; found {list(norm)}")
    return out


def to_decimal_odds(value) -> Optional[float]:
    """Accept decimal (1.57) or American (-175, +145) odds. None when blank/invalid."""
    if value is None:
        return None
    s = str(value).strip().replace(",", "")
    if not s or s.lower() in ("na", "nan", "none", "-", "pk", "pick"):
        return None
    try:
        v = float(s)
    except ValueError:
        return None
    if s.startswith("+") or v <= -100 or v >= 100:   # American
        if v > 0:
            return round(1 + v / 100.0, 3)
        if v < 0:
            return round(1 + 100.0 / abs(v), 3)
        return None
    return v if v > 1.0 else None


def _float(value) -> Optional[float]:
    if value is None:
        return None
    s = str(value).strip().lower()
    if not s or s in ("na", "nan", "none", "-"):
        return None
    if s in ("pk", "pick", "pick'em", "even"):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return None


def _parse_date(value: str, default_hour_utc: int) -> Optional[datetime]:
    s = str(value).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y%m%d"):
        try:
            dt = datetime.strptime(s.replace("Z", "+0000") if fmt.endswith("%z") else s, fmt)
        except ValueError:
            continue
        if dt.tzinfo is None:
            if fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y%m%d"):
                dt = dt.replace(hour=default_hour_utc)
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    return None


def synthetic_event_id(sport_key: str, day: str, home: str, away: str) -> str:
    raw = f"csv:{sport_key}:{day}:{home}:{away}"
    return "csv-" + hashlib.sha1(raw.encode("utf-8")).hexdigest()[:20]


def parse_csv(text: str, cfg: SportConfig, source: str, team_map: Optional[Dict[str, str]] = None,
              default_hour_utc: int = 23) -> Tuple[List[ImportedGame], ImportReport]:
    report = ImportReport(source=source, sport_key=cfg.key)
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise CsvFormatError("CSV has no header row")
    cols = _resolve_columns(reader.fieldnames)
    games: List[ImportedGame] = []

    def col(row, name):
        h = cols.get(name)
        return row.get(h) if h else None

    for i, row in enumerate(reader, start=2):
        report.rows += 1
        home_raw, away_raw = col(row, "home_team"), col(row, "away_team")
        home, away = canonical_team(cfg.key, home_raw, team_map), canonical_team(cfg.key, away_raw, team_map)
        if not home or not away:
            for raw, got in ((home_raw, home), (away_raw, away)):
                if not got:
                    report.unmapped_teams[str(raw)] = report.unmapped_teams.get(str(raw), 0) + 1
            report.skipped.append(f"line {i}: unmapped team(s) {home_raw!r} / {away_raw!r}")
            continue
        if home == away:
            report.skipped.append(f"line {i}: home == away ({home})")
            continue
        dt = _parse_date(col(row, "date"), default_hour_utc)
        if dt is None:
            report.skipped.append(f"line {i}: unparseable date {col(row, 'date')!r}")
            continue
        try:
            hs, as_ = int(float(col(row, "home_score"))), int(float(col(row, "away_score")))
        except (TypeError, ValueError):
            report.skipped.append(f"line {i}: missing/invalid score")
            continue
        if hs == as_:
            report.skipped.append(f"line {i}: tie ({hs}-{as_}) — 2-way label undefined")
            continue
        g = ImportedGame(
            event_id=synthetic_event_id(cfg.key, dt.strftime("%Y-%m-%d"), home, away),
            home_team=home, away_team=away, commence_time=dt, home_score=hs, away_score=as_,
            outcome="H" if hs > as_ else "A",
            home_odds=to_decimal_odds(col(row, "home_odds")), away_odds=to_decimal_odds(col(row, "away_odds")),
            home_spread=_float(col(row, "home_spread")), total=_float(col(row, "total")),
            spread_home_odds=to_decimal_odds(col(row, "spread_home_odds")),
            spread_away_odds=to_decimal_odds(col(row, "spread_away_odds")),
            over_odds=to_decimal_odds(col(row, "over_odds")), under_odds=to_decimal_odds(col(row, "under_odds")),
        )
        games.append(g)
        report.parsed += 1
        if g.has_moneyline:
            report.with_odds += 1
    return games, report


# ----------------------------------------------------------------------------- storage
def store_games(conn, games: List[ImportedGame], cfg: SportConfig, report: ImportReport, source: str) -> ImportReport:
    bookmaker = f"csv:{source}"[:64]
    with conn.cursor() as cur:
        for g in games:
            cur.execute(
                """
                INSERT INTO multisport_fixtures (sport, sport_key, event_id, home_team, away_team, commence_time,
                                                 league_name, home_score, away_score, outcome, status, updated_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'finished',NOW())
                ON CONFLICT (sport, event_id) DO UPDATE SET
                    home_score = EXCLUDED.home_score, away_score = EXCLUDED.away_score,
                    outcome = EXCLUDED.outcome, status = 'finished', updated_at = NOW()
                RETURNING (xmax = 0) AS inserted
                """,
                (cfg.sport, cfg.key, g.event_id, g.home_team, g.away_team, g.commence_time, cfg.league_name,
                 g.home_score, g.away_score, g.outcome),
            )
            if cur.fetchone()[0]:
                report.fixtures_new += 1
            else:
                report.fixtures_updated += 1

            cur.execute(
                """
                INSERT INTO multisport_match_results (sport_key, event_id, game_date, home_team, away_team,
                                                      home_score, away_score, result, status, updated_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'final',NOW())
                ON CONFLICT (sport_key, event_id) DO UPDATE SET
                    home_score = EXCLUDED.home_score, away_score = EXCLUDED.away_score,
                    result = EXCLUDED.result, updated_at = NOW()
                """,
                (cfg.key, g.event_id, g.commence_time, g.home_team, g.away_team, g.home_score, g.away_score, g.outcome),
            )
            report.results += 1
            cur.execute(
                """
                INSERT INTO multisport_schedule (sport_key, event_id, home_team, away_team, commence_time, status, updated_at)
                VALUES (%s,%s,%s,%s,%s,'final',NOW())
                ON CONFLICT (sport_key, event_id) DO UPDATE SET status = 'final', updated_at = NOW()
                """,
                (cfg.key, g.event_id, g.home_team, g.away_team, g.commence_time),
            )

            if g.has_moneyline:
                ph, pa = 1.0 / g.home_odds, 1.0 / g.away_odds
                overround = ph + pa
                cur.execute(
                    """
                    INSERT INTO multisport_odds_snapshots (
                        sport, sport_key, event_id, home_team, away_team, commence_time,
                        home_odds, away_odds, home_prob, away_prob,
                        home_spread, home_spread_odds, away_spread_odds,
                        total_line, over_odds, under_odds, overround, n_bookmakers,
                        bookmaker, is_consensus, ts_recorded)
                    VALUES (%s,%s,%s,%s,%s,%s, %s,%s,%s,%s, %s,%s,%s, %s,%s,%s,%s,1, %s,TRUE,%s)
                    ON CONFLICT (event_id, bookmaker, ts_recorded) DO NOTHING
                    """,
                    (cfg.sport, cfg.key, g.event_id, g.home_team, g.away_team, g.commence_time,
                     g.home_odds, g.away_odds, round(ph / overround, 4), round(pa / overround, 4),
                     g.home_spread, g.spread_home_odds, g.spread_away_odds,
                     g.total, g.over_odds, g.under_odds, round(overround, 4),
                     bookmaker, g.commence_time - timedelta(hours=1)),
                )
                report.snapshots += cur.rowcount
    conn.commit()
    return report


def import_csv_file(conn, sport_key: str, path: str, source: Optional[str] = None,
                    team_map: Optional[Dict[str, str]] = None, dry_run: bool = False,
                    default_hour_utc: int = 23) -> Dict:
    if sport_key not in SPORTS:
        raise ValueError(f"unknown sport {sport_key}")
    cfg = SPORTS[sport_key]
    src = source or path.rsplit("/", 1)[-1]
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        text = f.read()
    games, report = parse_csv(text, cfg, src, team_map=team_map, default_hour_utc=default_hour_utc)
    if dry_run:
        out = report.summary()
        out["dry_run"] = True
        out["date_range"] = [min(g.commence_time for g in games).date().isoformat(),
                             max(g.commence_time for g in games).date().isoformat()] if games else None
        return out
    store_games(conn, games, cfg, report, src)
    out = report.summary()
    out["dry_run"] = False
    return out
