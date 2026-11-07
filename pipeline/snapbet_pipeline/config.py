"""Static configuration: sports, seasons, model hyper-parameters, env lookup."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Dict, List, Tuple

ODDS_API_BASE_URL = "https://api.the-odds-api.com/v4"


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

# Sports enabled by default (the pivot): football + basketball. NHL stays
# configured but off unless PIPELINE_SPORTS lists it.
DEFAULT_SPORTS: List[str] = ["americanfootball_nfl", "basketball_nba", "basketball_ncaab"]

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

# Training policy: retrain when >= MIN_NEW_GAMES finished games since last
# train, or the model is older than MAX_MODEL_AGE_DAYS.
MIN_NEW_GAMES = 20
MAX_MODEL_AGE_DAYS = 7

# Honesty gate: a model is "edge_validated" only when, on temporal
# out-of-fold predictions, it beats "pick the consensus favorite" by at least
# EDGE_GATE_MIN_DELTA with at least EDGE_GATE_MIN_N games.
EDGE_GATE_MIN_N = 100
EDGE_GATE_MIN_DELTA = 0.02

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
        sports_env = os.getenv("PIPELINE_SPORTS", "").strip()
        sports = [s.strip() for s in sports_env.split(",") if s.strip()] or list(DEFAULT_SPORTS)
        unknown = [s for s in sports if s not in SPORTS]
        if unknown:
            raise ValueError(f"Unknown sport keys in PIPELINE_SPORTS: {unknown}. Known: {sorted(SPORTS)}")
        return cls(
            database_url=os.getenv("DATABASE_URL", ""),
            odds_api_key=os.getenv("ODDS_API_KEY", ""),
            sports=sports,
            models_dir=os.getenv("PIPELINE_MODELS_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")),
            odds_api_base_url=os.getenv("ODDS_API_BASE_URL", ODDS_API_BASE_URL),
        )


def model_registry_id(sport_key: str) -> str:
    """Registry id used in model_track_record.model (mirrors utils/edge.py)."""
    family = SPORTS[sport_key].sport if sport_key in SPORTS else sport_key.split("_", 1)[0]
    return {
        "basketball": "v3_multisport_basketball",
        "american-football": "v3_multisport_football",
        "hockey": "v3_multisport_hockey",
    }.get(family, f"v3_multisport_{family}")
