"""Team display + colour canonicalisation across 2018-2024.

The *car effect* stays per raw team-season (a rename does not merge two cars),
so this module is display-only: it maps FastF1's season-varying team strings to
a stable constructor lineage, a display name, and a colour.

Lineages (constructor continuity across renames):
    red_bull   Red Bull Racing
    ferrari    Ferrari
    mercedes   Mercedes
    mclaren    McLaren
    alpine     Renault -> Alpine
    aston      Force India -> Racing Point -> Aston Martin
    rb         Toro Rosso -> AlphaTauri -> RB   (the junior team)
    sauber     Sauber -> Alfa Romeo -> Kick Sauber
    haas       Haas
    williams   Williams
"""

from __future__ import annotations

# Ordered substring rules: first match wins (checked lower-cased).
_LINEAGE_RULES = [
    ("red bull", "red_bull"),
    ("ferrari", "ferrari"),
    ("mercedes", "mercedes"),
    ("mclaren", "mclaren"),
    ("alpine", "alpine"),
    ("renault", "alpine"),
    ("aston martin", "aston"),
    ("racing point", "aston"),
    ("force india", "aston"),
    ("alphatauri", "rb"),
    ("toro rosso", "rb"),
    ("scuderia rb", "rb"),
    ("racing bulls", "rb"),
    ("rb f1", "rb"),
    ("alfa romeo", "sauber"),
    ("kick sauber", "sauber"),
    ("sauber", "sauber"),
    ("haas", "haas"),
    ("williams", "williams"),
]

# Lineage colour (current-era constructor palette from WHITEPAPER §03, extended).
_LINEAGE_COLOR = {
    "red_bull": "#3671C6",
    "ferrari":  "#E8002D",
    "mercedes": "#27F4D2",
    "mclaren":  "#FF8000",
    "alpine":   "#0093CC",
    "aston":    "#229971",
    "rb":       "#6692FF",
    "sauber":   "#52E252",
    "haas":     "#B6BABD",
    "williams": "#64C4FF",
}

# Historical liveries that read wrong under the current palette. Keyed by
# (lineage, season) -> hex; falls back to the lineage colour when absent.
_ERA_COLOR = {
    ("alpine", 2018): "#FFF500", ("alpine", 2019): "#FFF500", ("alpine", 2020): "#FFF500",  # Renault yellow
    ("aston", 2018): "#F596C8", ("aston", 2019): "#F596C8", ("aston", 2020): "#F596C8",     # Force India / Racing Point pink
    ("rb", 2018): "#469BFF", ("rb", 2019): "#469BFF",                                        # Toro Rosso
    ("sauber", 2018): "#9B0000",                                                             # Sauber maroon
    ("sauber", 2019): "#900000", ("sauber", 2020): "#900000",
    ("sauber", 2021): "#900000", ("sauber", 2022): "#900000", ("sauber", 2023): "#900000",  # Alfa Romeo red
}

LINEAGE_LABEL = {
    "red_bull": "Red Bull", "ferrari": "Ferrari", "mercedes": "Mercedes",
    "mclaren": "McLaren", "alpine": "Alpine", "aston": "Aston Martin",
    "rb": "RB", "sauber": "Sauber", "haas": "Haas", "williams": "Williams",
}


def lineage(team: str) -> str:
    """Map a raw FastF1 team string to its constructor lineage key."""
    t = (team or "").lower()
    for needle, key in _LINEAGE_RULES:
        if needle in t:
            return key
    return "unknown"


def display_name(team: str) -> str:
    """Human-readable team name (tidies the raw FastF1 string)."""
    return (team or "").replace(" F1 Team", "").strip()


def color(team: str, season: int | None = None) -> str:
    """Constructor colour for a team-season (era liveries respected)."""
    lin = lineage(team)
    if season is not None and (lin, season) in _ERA_COLOR:
        return _ERA_COLOR[(lin, season)]
    return _LINEAGE_COLOR.get(lin, "#8B9099")
