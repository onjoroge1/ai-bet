"""Static configuration: sports, seasons, model hyper-parameters, env lookup."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Dict, List, Tuple

ODDS_API_BASE_URL = "https://api.the-odds-api.com/v4"


# --------------------------------------------------------------------- env files
_PKG_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))     # pipeline/
ENV_FILES = (os.path.join(_PKG_ROOT, ".env"),                               # pipeline/.env
             os.path.join(os.path.dirname(_PKG_ROOT), ".env.local"),        # the Next.js app's
             os.path.join(os.path.dirname(_PKG_ROOT), ".env"))
# Prisma-only query parameters that libpq/psycopg2 rejects ("invalid URI query parameter")
_PRISMA_PARAMS = {"pgbouncer", "connection_limit", "pool_timeout", "connect_timeout_ms", "schema", "statement_cache_size"}


def read_env_files(paths=ENV_FILES) -> Dict[str, str]:
    """KEY=VALUE pairs from the env files, earlier files winning. Never overrides the process env."""
    out: Dict[str, str] = {}
    for path in paths:
        try:
            with open(path, encoding="utf-8") as fh:
                lines = fh.read().splitlines()
        except OSError:
            continue
        for line in lines:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip().removeprefix("export ").strip()
            val = val.strip()
            if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
                val = val[1:-1]
            if key and key not in out:
                out[key] = val
    return out


def libpq_url(url: str) -> str:
    """Drop Prisma-only query parameters so psycopg2 accepts a Prisma/Neon URL."""
    if "?" not in url:
        return url
    from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
    parts = urlsplit(url)
    q = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k not in _PRISMA_PARAMS]
    return urlunsplit(parts._replace(query=urlencode(q)))


def env(name: str, files: Dict[str, str], default: str = "") -> str:
    return os.environ.get(name) or files.get(name) or default


def resolve_database_url(files: Dict[str, str]) -> str:
    """The direct (unpooled) Neon URL when one is available, else DATABASE_URL cleaned for libpq."""
    url = (os.environ.get("DATABASE_URL_UNPOOLED") or os.environ.get("DATABASE_URL")
           or files.get("DATABASE_URL_UNPOOLED") or files.get("DATABASE_URL"))
    return libpq_url(url) if url else ""


@dataclass(frozen=True)
class SportConfig:
    key: str                     # The Odds API sport_key
    name: str                    # display name
    sport: str                   # family: basketball | american-football | hockey
    markets: Tuple[str, ...] = ("h2h", "spreads", "totals")
    regions: str = "us"
    active_months: Tuple[int, ...] = ()
    # season window (month, day) used by season_progress feature
    season_start: Tuple[int, int] = (10, 1)
    season_end: Tuple[int, int] = (4, 30)
    elo_home_adv: float = 35.0
    min_train_samples: int = 150
    # frontend-facing label used in MultisportMatch.league when the API gives none
    league_name: str = ""
    # how many days of finished games to re-pull for settlement
    results_lookback_days: int = 3

    def in_season(self, month: int) -> bool:
        return month in self.active_months


SPORTS: Dict[str, SportConfig] = {
    "americanfootball_nfl": SportConfig(
        key="americanfootball_nfl", name="NFL", sport="american-football",
        active_months=(9, 10, 11, 12, 1, 2),
        season_start=(9, 7), season_end=(2, 12),
        elo_home_adv=48.0, min_train_samples=120, league_name="NFL",
    ),
    "basketball_nba": SportConfig(
        key="basketball_nba", name="NBA", sport="basketball",
        active_months=(10, 11, 12, 1, 2, 3, 4, 5, 6),
        season_start=(10, 22), season_end=(4, 15),
        elo_home_adv=35.0, min_train_samples=150, league_name="NBA",
    ),
    "basketball_ncaab": SportConfig(
        key="basketball_ncaab", name="NCAAB", sport="basketball",
        active_months=(11, 12, 1, 2, 3, 4),
        season_start=(11, 4), season_end=(4, 7),
        elo_home_adv=70.0, min_train_samples=150, league_name="NCAA Basketball",
    ),
    "icehockey_nhl": SportConfig(
        key="icehockey_nhl", name="NHL", sport="hockey",
        active_months=(10, 11, 12, 1, 2, 3, 4, 5, 6),
        season_start=(10, 8), season_end=(4, 18),
        elo_home_adv=25.0, min_train_samples=150, league_name="NHL",
    ),
}

# Sports enabled by default: NFL + NBA + NHL (must match lib/multisport/sports.ts
# `display: true`). NCAAB stays configured but off unless PIPELINE_SPORTS lists it.
DEFAULT_SPORTS: List[str] = ["americanfootball_nfl", "basketball_nba", "icehockey_nhl"]

# ELO parameters (shared with feature builder)
ELO_K = 20.0
ELO_START = 1500.0
B2B_HOURS = 26.0

# LightGBM parameters per sport family (ported from train_multisport_v3.py)
LGBM_PARAMS = {
    "objective": "binary",
    "metric": "binary_logloss",
    "boosting_type": "gbdt",
    "num_leaves": 31,
    "learning_rate": 0.05,
    "feature_fraction": 0.8,
    "bagging_fraction": 0.8,
    "bagging_freq": 5,
    "min_data_in_leaf": 10,
    "lambda_l1": 0.1,
    "lambda_l2": 0.1,
    "verbose": -1,
    "n_jobs": -1,
}
N_ESTIMATORS = 500
EARLY_STOPPING = 50

# Market-anchored model (default since 2026-11-07). LightGBM starts every game at
# logit(consensus home prob) (init_score) and learns only a small, heavily
# regularised correction. The number of boosting rounds is chosen by an inner
# temporal CV from ANCHOR_ROUND_CANDIDATES; 0 means "the market is the model".
# Backtest on 729 imported games: the unanchored model above lost 0.01-0.03 log
# loss to the market in every sport; the anchored one never strays far from it.
ANCHOR_PARAMS = {
    "objective": "binary",
    "metric": "binary_logloss",
    "num_leaves": 4,
    "max_depth": 2,
    "learning_rate": 0.02,
    "min_data_in_leaf": 30,
    "feature_fraction": 0.7,
    "bagging_fraction": 0.8,
    "bagging_freq": 1,
    "lambda_l2": 10.0,
    "verbose": -1,
    "n_jobs": -1,
}
ANCHOR_ROUND_CANDIDATES = (0, 10, 25, 50, 100, 200)
# Parsimony: a correction (rounds > 0) is chosen only if it beats "market only" in
# the inner CV by at least this much log loss per validation game. Without it the
# selection on small folds is noisy (NBA folds picked 100 rounds and lost 0.011).
ANCHOR_MIN_INNER_GAIN = 0.002

# Training policy: retrain when >= MIN_NEW_GAMES finished games since last
# train, or the model is older than MAX_MODEL_AGE_DAYS.
MIN_NEW_GAMES = 20
MAX_MODEL_AGE_DAYS = 7

# Honesty gate: a model is "edge_validated" only when, on nested temporal
# out-of-fold predictions over at least EDGE_GATE_MIN_N games, its log loss beats
# the de-vigged consensus probability by at least EDGE_GATE_MIN_LOGLOSS_GAIN and
# its Brier score is no worse. Accuracy vs "pick the favorite" is still reported
# but decides nothing: value betting depends on probabilities, not on picks.
EDGE_GATE_MIN_N = 100
EDGE_GATE_MIN_LOGLOSS_GAIN = 0.005
EDGE_GATE_MIN_DELTA = 0.02   # legacy accuracy margin, reported only

# Value bets (emitted only when the gate passed): the model must beat the
# de-vigged consensus by VALUE_MIN_EDGE and show positive EV at the CONSENSUS
# price. Selecting on the best single-book price made almost every game "value"
# because the max of ~10 noisy quotes nearly always beats the average.
VALUE_MIN_EDGE = 0.03

# Edge rating tiers (EV at best price) — mirror utils/edge.py RATING_TIERS
RATING_TIERS = ((0.08, "strong_value"), (0.03, "value"), (0.0, "marginal"))


@dataclass
class Settings:
    database_url: str
    odds_api_key: str
    sports: List[str] = field(default_factory=lambda: list(DEFAULT_SPORTS))
    models_dir: str = "models"
    odds_api_base_url: str = ODDS_API_BASE_URL

    @classmethod
    def from_env(cls) -> "Settings":
        files = read_env_files()
        sports_env = env("PIPELINE_SPORTS", files).strip()
        sports = [s.strip() for s in sports_env.split(",") if s.strip()] or list(DEFAULT_SPORTS)
        unknown = [s for s in sports if s not in SPORTS]
        if unknown:
            raise ValueError(f"Unknown sport keys in PIPELINE_SPORTS: {unknown}. Known: {sorted(SPORTS)}")
        return cls(
            database_url=resolve_database_url(files),
            odds_api_key=env("ODDS_API_KEY", files),
            sports=sports,
            models_dir=env("PIPELINE_MODELS_DIR", files, os.path.join(_PKG_ROOT, "models")),
            odds_api_base_url=env("ODDS_API_BASE_URL", files, ODDS_API_BASE_URL),
        )


def model_registry_id(sport_key: str) -> str:
    """Registry id used in model_track_record.model (mirrors utils/edge.py)."""
    family = SPORTS[sport_key].sport if sport_key in SPORTS else sport_key.split("_", 1)[0]
    return {
        "basketball": "v3_multisport_basketball",
        "american-football": "v3_multisport_football",
        "hockey": "v3_multisport_hockey",
    }.get(family, f"v3_multisport_{family}")
