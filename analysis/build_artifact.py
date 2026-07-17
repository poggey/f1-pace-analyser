#!/usr/bin/env python
"""Headless end-to-end build of the APEX dashboard artifact.

    python analysis/build_artifact.py            # build apex.json from cached data
    python analysis/build_artifact.py --refetch  # re-download the data first

Runs: ingest -> clean -> normalise -> trim (data.build_model_dataset)
      -> fit -> bootstrap -> career arc -> views -> apex.json (apex.build).
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from analysis.apex import SEASONS
from analysis.apex.data import build_model_dataset, model_path
from analysis.apex.build import build, write


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refetch", action="store_true",
                    help="re-download seasons from FastF1 before building")
    ap.add_argument("--reps", type=int, default=300, help="bootstrap repetitions")
    args = ap.parse_args()

    if args.refetch or not model_path(SEASONS).exists():
        build_model_dataset(SEASONS, force=args.refetch)

    write(build(SEASONS, n_reps=args.reps))


if __name__ == "__main__":
    main()
