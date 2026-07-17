#!/usr/bin/env python
"""One-shot: complete the 2024 backfill (rate-limited on first pass), then rebuild.

FastF1 caps at 500 API calls/hour; the initial 2018-2024 pull exhausted the
window mid-2024 (rounds 1-11 only). This polls until the window frees, pulls the
missing rounds (already-loaded sessions come from cache, so only the gaps hit the
API), then regenerates the model parquet + apex.json and verifies.
"""

import time
import pandas as pd

import fastf1
from analysis.apex import SEASONS, CACHE
from analysis.apex.data import raw_path, build_model_dataset
from analysis.apex.ingest import load_qualifying
from analysis.apex.build import build, write

fastf1.Cache.enable_cache(str(CACHE))


def rounds_have(season):
    p = raw_path(season)
    if not p.exists():
        return set()
    return {int(x) for x in pd.read_parquet(p)["Round"].unique()}


def main():
    sched = fastf1.get_event_schedule(2024, include_testing=False)
    target = int(sched["RoundNumber"].max())
    print(f"2024 schedule: {target} rounds", flush=True)

    for attempt in range(1, 20):
        got = rounds_have(2024)
        print(f"[attempt {attempt}] have {len(got)}/{target} rounds: {sorted(got)}", flush=True)
        if len(got) >= target - 1:          # allow at most one genuinely-empty round
            break
        # drop the partial file so ensure/load re-pulls; FastF1 keeps loaded sessions
        p = raw_path(2024)
        if p.exists():
            p.unlink()
        try:
            df = load_qualifying(2024, verbose=True)
            df.to_parquet(p)
        except Exception as exc:  # noqa: BLE001
            print(f"  pull error: {type(exc).__name__}: {exc}", flush=True)
        if len(rounds_have(2024)) < target - 1:
            print("  still incomplete (rate limit) - sleeping 300s", flush=True)
            time.sleep(300)

    print(f"\n2024 complete: {sorted(rounds_have(2024))}", flush=True)
    build_model_dataset(SEASONS, force=False, verbose=True)
    write(build(SEASONS, n_reps=300, verbose=False))
    print("TOPUP_DONE", flush=True)


if __name__ == "__main__":
    main()
