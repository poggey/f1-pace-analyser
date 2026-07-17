"""Stage 2 — keep only genuine flying laps.

A real qualifying lap is a completed timed lap, not an in-/out-lap, not deleted,
run under a fully green track, and marked reliable by FastF1. Each filter is
applied one at a time and the drop count reported, so the cleaning is transparent.
"""

from __future__ import annotations

import pandas as pd

# The ~10 columns that bear on pace (the raw table has ~34).
KEEP_COLS = [
    "Season", "Round", "EventName",   # which session (tells us the circuit)
    "Driver", "Team",                  # who drove + which car
    "LapNumber", "LapTime",            # the lap and its raw pace
    "Compound", "TyreLife",            # tyre context (sanity checks)
    "IsPersonalBest",                  # sanity flag
]


def clean_laps(raw: pd.DataFrame, *, verbose: bool = True) -> pd.DataFrame:
    """Filter raw laps down to genuine flying laps, then slim to KEEP_COLS."""
    laps = raw.copy()

    def keep(mask: pd.Series, reason: str) -> None:
        nonlocal laps
        before = len(laps)
        laps = laps[mask].copy()
        if verbose:
            print(f"  drop {before - len(laps):>6,}  ({reason})  ->  {len(laps):,} left")

    if verbose:
        print(f"Start: {len(laps):,} laps")
    keep(laps["LapTime"].notna(),          "no lap time  (out-lap / aborted run)")
    keep(laps["PitOutTime"].isna(),        "out-lap  (just left the pits)")
    keep(laps["PitInTime"].isna(),         "in-lap  (returning to the pits)")
    keep(~laps["Deleted"].fillna(False).astype(bool),   "deleted  (e.g. track limits)")
    keep(laps["TrackStatus"] == "1",                    "not fully green  (yellow / SC / red)")
    keep(laps["IsAccurate"].fillna(False).astype(bool), "flagged unreliable by FastF1")
    if verbose:
        print(f"Clean flying laps: {len(laps):,}")

    clean = laps[KEEP_COLS].reset_index(drop=True)
    # LapTime is a duration; add a plain seconds column for reading/plotting.
    clean["LapTimeSeconds"] = clean["LapTime"].dt.total_seconds()
    return clean
