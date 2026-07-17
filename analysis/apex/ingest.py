"""Stage 1 — pull qualifying laps from FastF1.

FastF1 talks to the official F1 timing servers; the on-disk cache means each
session is downloaded once and read locally forever after. We load laps +
weather + race-control but NOT telemetry (~100x larger, not needed for pace).
"""

from __future__ import annotations

import fastf1
import pandas as pd

from . import CACHE

_CACHE_READY = False


def _enable_cache() -> None:
    global _CACHE_READY
    if not _CACHE_READY:
        fastf1.Cache.enable_cache(str(CACHE))
        _CACHE_READY = True


def load_qualifying(season: int, *, verbose: bool = True) -> pd.DataFrame:
    """Download & stack every qualifying (``"Q"``) session of one season.

    One row per lap, tagged with Season / Round / EventName so sessions never
    blur together. Sessions that fail to load are skipped loudly rather than
    silently dropped (a missing round is visible in the printed log).
    """
    _enable_cache()
    schedule = fastf1.get_event_schedule(season, include_testing=False)

    frames: list[pd.DataFrame] = []
    for rnd, name in zip(schedule["RoundNumber"], schedule["EventName"]):
        try:
            session = fastf1.get_session(season, int(rnd), "Q")
            session.load(telemetry=False, weather=False, messages=False)
            laps = session.laps.copy()
        except Exception as exc:  # noqa: BLE001 - report and continue
            if verbose:
                print(f"  R{int(rnd):>2}  {name:<34} SKIPPED ({type(exc).__name__}: {exc})")
            continue
        laps["Season"] = season
        laps["Round"] = int(rnd)
        laps["EventName"] = name
        frames.append(laps)
        if verbose:
            print(f"  R{int(rnd):>2}  {name:<34} {len(laps):>4} laps")

    if not frames:
        raise RuntimeError(f"no qualifying sessions loaded for {season}")

    out = pd.DataFrame(pd.concat(frames, ignore_index=True))
    if verbose:
        print(f"  {season}: {out.shape[0]:,} laps x {out.shape[1]} cols "
              f"({out['Round'].nunique()} sessions)")
    return out


def load_seasons(seasons, *, verbose: bool = True) -> pd.DataFrame:
    """Ingest several seasons and concatenate into one raw lap table."""
    frames = []
    for s in seasons:
        if verbose:
            print(f"\n=== {s} ===")
        frames.append(load_qualifying(s, verbose=verbose))
    return pd.DataFrame(pd.concat(frames, ignore_index=True))
