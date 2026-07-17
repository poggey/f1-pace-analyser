"""Assemble the model-ready dataset (Stages 1-3b) for a set of seasons.

Resumable: each season's raw laps are cached to its own parquet, so a failed or
interrupted download only re-pulls the missing seasons. The combined, cleaned,
normalised, trimmed table is written to ``laps_q_<lo>_<hi>_model.parquet``.
"""

from __future__ import annotations

import pandas as pd

from . import PARQUET, SEASONS
from .ingest import load_qualifying
from .clean import clean_laps
from .normalise import normalise, trim


def raw_path(season: int):
    return PARQUET / f"laps_q_{season}_raw.parquet"


def model_path(seasons=SEASONS):
    lo, hi = min(seasons), max(seasons)
    return PARQUET / f"laps_q_{lo}_{hi}_model.parquet"


def ensure_raw(season: int, *, force: bool = False, verbose: bool = True) -> pd.DataFrame:
    """Load a season's raw laps from disk, downloading (once) if missing."""
    p = raw_path(season)
    if p.exists() and not force:
        df = pd.read_parquet(p)
        if verbose:
            print(f"  {season}: cached raw parquet ({len(df):,} laps)")
        return df
    df = load_qualifying(season, verbose=verbose)
    df.to_parquet(p)
    if verbose:
        print(f"  {season}: saved {p.name}")
    return df


def build_model_dataset(seasons=SEASONS, *, force: bool = False, verbose: bool = True) -> pd.DataFrame:
    """Full Stage 1-3b chain across seasons -> representative laps parquet."""
    raws = []
    for s in seasons:
        if verbose:
            print(f"\n=== ingest {s} ===")
        raws.append(ensure_raw(s, force=force, verbose=verbose))
    raw = pd.DataFrame(pd.concat(raws, ignore_index=True))

    if verbose:
        print("\n=== clean ===")
    clean = clean_laps(raw, verbose=verbose)

    if verbose:
        print("\n=== normalise + trim ===")
    model = trim(normalise(clean), verbose=verbose)

    out = model_path(seasons)
    model.to_parquet(out)
    if verbose:
        print(f"\nSaved {out.name}: {len(model):,} laps, "
              f"{model['Driver'].nunique()} drivers, {model['Team'].nunique()} teams, "
              f"seasons {sorted(model['Season'].unique())}")
    return model


if __name__ == "__main__":
    build_model_dataset()
