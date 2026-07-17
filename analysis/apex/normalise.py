"""Stage 3 / 3b — normalise pace across circuits, then trim to competitive laps.

Within each session the fastest lap is the benchmark; every lap becomes a
percentage gap to it, so a 0.3% gap means the same thing at Monaco and Monza.
Then the 107% rule keeps only laps within 7% of the session best, discarding
the tail of cool-down / preparation laps that survive the Stage 2 flag filters.
"""

from __future__ import annotations

import pandas as pd

MAX_PCT = 7.0  # 107% rule: keep laps within 7% of the session's best lap


def normalise(clean: pd.DataFrame) -> pd.DataFrame:
    """Add SessionBest and PacePct (% slower than the session's fastest lap)."""
    out = clean.copy()
    out["SessionBest"] = out.groupby(["Season", "Round"])["LapTimeSeconds"].transform("min")
    out["PacePct"] = 100 * (out["LapTimeSeconds"] - out["SessionBest"]) / out["SessionBest"]
    return out


def trim(norm: pd.DataFrame, *, max_pct: float = MAX_PCT, verbose: bool = True) -> pd.DataFrame:
    """Drop laps slower than ``max_pct`` off the session best (107% rule)."""
    model = norm[norm["PacePct"] <= max_pct].reset_index(drop=True)
    if verbose:
        print(f"{len(norm):,} normalised -> {len(model):,} representative "
              f"({len(model) / len(norm):.0%} kept, <= {max_pct}% off pole)")
    return model
