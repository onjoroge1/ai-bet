"""Team-name normalisation for CSV imports.

The Odds API identifies teams by full name ("Buffalo Bills"). Public CSVs use
abbreviations ("BUF"), city names ("Buffalo") or nicknames ("Bills"). Imported
games must land under the same names the live collector writes, otherwise
ELO / form / head-to-head features never connect the two eras.

`canonical_team(sport_key, raw)` resolves a raw label to the canonical name,
or returns None when it cannot (the importer then refuses the row and lists
it in its report — never guesses). A user-supplied JSON map (--team-map) is
consulted first so unusual labels can be fixed without a code change.

The alias tables below are the current franchises' full names, cities and the
usual 2–3 letter codes. Relocations/renames (e.g. Washington Commanders,
Oakland → Las Vegas Raiders) map to the current name.
"""
from __future__ import annotations

import re
from typing import Dict, Iterable, Optional

NFL = [
    ("Arizona Cardinals", ["ARI", "ARZ", "Arizona", "Cardinals"]),
    ("Atlanta Falcons", ["ATL", "Atlanta", "Falcons"]),
    ("Baltimore Ravens", ["BAL", "Baltimore", "Ravens"]),
    ("Buffalo Bills", ["BUF", "Buffalo", "Bills"]),
    ("Carolina Panthers", ["CAR", "Carolina", "Panthers"]),
    ("Chicago Bears", ["CHI", "Chicago", "Bears"]),
    ("Cincinnati Bengals", ["CIN", "Cincinnati", "Bengals"]),
    ("Cleveland Browns", ["CLE", "Cleveland", "Browns"]),
    ("Dallas Cowboys", ["DAL", "Dallas", "Cowboys"]),
    ("Denver Broncos", ["DEN", "Denver", "Broncos"]),
    ("Detroit Lions", ["DET", "Detroit", "Lions"]),
    ("Green Bay Packers", ["GB", "GNB", "Green Bay", "Packers"]),
    ("Houston Texans", ["HOU", "Houston", "Texans"]),
    ("Indianapolis Colts", ["IND", "Indianapolis", "Colts"]),
    ("Jacksonville Jaguars", ["JAX", "JAC", "Jacksonville", "Jaguars"]),
    ("Kansas City Chiefs", ["KC", "KAN", "Kansas City", "Chiefs"]),
    ("Las Vegas Raiders", ["LV", "LVR", "OAK", "Las Vegas", "Oakland Raiders", "Raiders"]),
    ("Los Angeles Chargers", ["LAC", "SD", "SDG", "LA Chargers", "San Diego Chargers", "Chargers"]),
    ("Los Angeles Rams", ["LAR", "LA", "STL", "LA Rams", "St. Louis Rams", "Rams"]),
    ("Miami Dolphins", ["MIA", "Miami", "Dolphins"]),
    ("Minnesota Vikings", ["MIN", "Minnesota", "Vikings"]),
    ("New England Patriots", ["NE", "NWE", "New England", "Patriots"]),
    ("New Orleans Saints", ["NO", "NOR", "New Orleans", "Saints"]),
    ("New York Giants", ["NYG", "NY Giants", "Giants"]),
    ("New York Jets", ["NYJ", "NY Jets", "Jets"]),
    ("Philadelphia Eagles", ["PHI", "Philadelphia", "Eagles"]),
    ("Pittsburgh Steelers", ["PIT", "Pittsburgh", "Steelers"]),
    ("San Francisco 49ers", ["SF", "SFO", "San Francisco", "49ers", "Niners"]),
    ("Seattle Seahawks", ["SEA", "Seattle", "Seahawks"]),
    ("Tampa Bay Buccaneers", ["TB", "TAM", "Tampa Bay", "Buccaneers", "Bucs"]),
    ("Tennessee Titans", ["TEN", "Tennessee", "Titans"]),
    ("Washington Commanders", ["WAS", "WSH", "Washington", "Commanders", "Washington Football Team", "Washington Redskins"]),
]

NBA = [
    ("Atlanta Hawks", ["ATL", "Atlanta", "Hawks"]),
    ("Boston Celtics", ["BOS", "Boston", "Celtics"]),
    ("Brooklyn Nets", ["BKN", "BRK", "Brooklyn", "Nets", "New Jersey Nets"]),
    ("Charlotte Hornets", ["CHA", "CHO", "Charlotte", "Hornets", "Charlotte Bobcats"]),
    ("Chicago Bulls", ["CHI", "Chicago", "Bulls"]),
    ("Cleveland Cavaliers", ["CLE", "Cleveland", "Cavaliers", "Cavs"]),
    ("Dallas Mavericks", ["DAL", "Dallas", "Mavericks", "Mavs"]),
    ("Denver Nuggets", ["DEN", "Denver", "Nuggets"]),
    ("Detroit Pistons", ["DET", "Detroit", "Pistons"]),
    ("Golden State Warriors", ["GSW", "GS", "Golden State", "Warriors"]),
    ("Houston Rockets", ["HOU", "Houston", "Rockets"]),
    ("Indiana Pacers", ["IND", "Indiana", "Pacers"]),
    ("Los Angeles Clippers", ["LAC", "LA Clippers", "Clippers"]),
    ("Los Angeles Lakers", ["LAL", "LA Lakers", "Lakers"]),
    ("Memphis Grizzlies", ["MEM", "Memphis", "Grizzlies"]),
    ("Miami Heat", ["MIA", "Miami", "Heat"]),
    ("Milwaukee Bucks", ["MIL", "Milwaukee", "Bucks"]),
    ("Minnesota Timberwolves", ["MIN", "Minnesota", "Timberwolves", "Wolves"]),
    ("New Orleans Pelicans", ["NOP", "NO", "New Orleans", "Pelicans"]),
    ("New York Knicks", ["NYK", "NY Knicks", "New York", "Knicks"]),
    ("Oklahoma City Thunder", ["OKC", "Oklahoma City", "Thunder"]),
    ("Orlando Magic", ["ORL", "Orlando", "Magic"]),
    ("Philadelphia 76ers", ["PHI", "Philadelphia", "76ers", "Sixers"]),
    ("Phoenix Suns", ["PHX", "PHO", "Phoenix", "Suns"]),
    ("Portland Trail Blazers", ["POR", "Portland", "Trail Blazers", "Blazers"]),
    ("Sacramento Kings", ["SAC", "Sacramento", "Kings"]),
    ("San Antonio Spurs", ["SAS", "SA", "San Antonio", "Spurs"]),
    ("Toronto Raptors", ["TOR", "Toronto", "Raptors"]),
    ("Utah Jazz", ["UTA", "UTAH", "Utah", "Jazz"]),
    ("Washington Wizards", ["WAS", "WSH", "Washington", "Wizards"]),
]

NHL = [
    ("Anaheim Ducks", ["ANA", "Anaheim", "Ducks"]),
    ("Boston Bruins", ["BOS", "Boston", "Bruins"]),
    ("Buffalo Sabres", ["BUF", "Buffalo", "Sabres"]),
    ("Calgary Flames", ["CGY", "Calgary", "Flames"]),
    ("Carolina Hurricanes", ["CAR", "Carolina", "Hurricanes", "Canes"]),
    ("Chicago Blackhawks", ["CHI", "Chicago", "Blackhawks"]),
    ("Colorado Avalanche", ["COL", "Colorado", "Avalanche", "Avs"]),
    ("Columbus Blue Jackets", ["CBJ", "Columbus", "Blue Jackets"]),
    ("Dallas Stars", ["DAL", "Dallas", "Stars"]),
    ("Detroit Red Wings", ["DET", "Detroit", "Red Wings"]),
    ("Edmonton Oilers", ["EDM", "Edmonton", "Oilers"]),
    ("Florida Panthers", ["FLA", "Florida", "Panthers"]),
    ("Los Angeles Kings", ["LAK", "LA Kings", "Kings"]),
    ("Minnesota Wild", ["MIN", "Minnesota", "Wild"]),
    ("Montreal Canadiens", ["MTL", "Montreal", "Montréal Canadiens", "Canadiens", "Habs"]),
    ("Nashville Predators", ["NSH", "Nashville", "Predators", "Preds"]),
    ("New Jersey Devils", ["NJD", "NJ", "New Jersey", "Devils"]),
    ("New York Islanders", ["NYI", "NY Islanders", "Islanders"]),
    ("New York Rangers", ["NYR", "NY Rangers", "Rangers"]),
    ("Ottawa Senators", ["OTT", "Ottawa", "Senators", "Sens"]),
    ("Philadelphia Flyers", ["PHI", "Philadelphia", "Flyers"]),
    ("Pittsburgh Penguins", ["PIT", "Pittsburgh", "Penguins", "Pens"]),
    ("San Jose Sharks", ["SJS", "SJ", "San Jose", "Sharks"]),
    ("Seattle Kraken", ["SEA", "Seattle", "Kraken"]),
    ("St Louis Blues", ["STL", "St. Louis Blues", "St Louis", "St. Louis", "Blues"]),
    ("Tampa Bay Lightning", ["TBL", "TB", "Tampa Bay", "Lightning", "Bolts"]),
    ("Toronto Maple Leafs", ["TOR", "Toronto", "Maple Leafs", "Leafs"]),
    ("Utah Mammoth", ["UTA", "UTAH", "Utah", "Mammoth", "Utah Hockey Club", "Arizona Coyotes", "ARI"]),
    ("Vancouver Canucks", ["VAN", "Vancouver", "Canucks"]),
    ("Vegas Golden Knights", ["VGK", "LV", "Vegas", "Las Vegas", "Golden Knights"]),
    ("Washington Capitals", ["WSH", "WAS", "Washington", "Capitals", "Caps"]),
    ("Winnipeg Jets", ["WPG", "Winnipeg", "Jets"]),
]

_TABLES = {"americanfootball_nfl": NFL, "basketball_nba": NBA, "icehockey_nhl": NHL}


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def _build(table) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for canonical, aliases in table:
        out[_norm(canonical)] = canonical
        for a in aliases:
            out[_norm(a)] = canonical
    return out


_INDEX: Dict[str, Dict[str, str]] = {k: _build(v) for k, v in _TABLES.items()}


def canonical_names(sport_key: str) -> Iterable[str]:
    return [c for c, _ in _TABLES.get(sport_key, [])]


def canonical_team(sport_key: str, raw: str, user_map: Optional[Dict[str, str]] = None) -> Optional[str]:
    """Resolve a CSV team label to the canonical (Odds API) name, or None."""
    if raw is None:
        return None
    raw = str(raw).strip()
    if not raw:
        return None
    if user_map:
        for k, v in user_map.items():
            if _norm(k) == _norm(raw):
                return v
    idx = _INDEX.get(sport_key)
    if idx is None:
        return raw  # no table for this sport (e.g. NCAAB) — trust the label
    return idx.get(_norm(raw))
