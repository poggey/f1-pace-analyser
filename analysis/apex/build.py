"""Stage 6 — assemble and write the dashboard artifact (apex.json).

Runs the whole chain from the model-ready parquet: fit -> bootstrap -> arc ->
views -> a single compact JSON the dashboard fetches client-side. Writes to
``frontend/public/data/apex.json`` (served) and ``analysis/apex.json`` (a copy
kept beside the notebook).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

import pandas as pd

from . import PARQUET, REPO, SEASONS
from .data import model_path
from . import model as M
from . import views as V

LIMITATIONS = [
    "In-season development: a car's performance is not constant across a year; "
    "the car effect is modelled per car-season, so mid-season upgrades are averaged.",
    "Driver-car fit: the additive model assumes skill is portable; a real "
    "driver-car interaction is folded into noise.",
    "Constant skill: the headline rating assumes one skill per driver across all "
    "seasons; the career arc relaxes this as a shrunk per-season deviation.",
    "Wet & chaos laps are excluded (only fully-green, non-deleted flying laps "
    "survive cleaning) - conservative, but discards laps where skill matters most.",
    "Small samples: part-season and rookie drivers carry wide confidence bands; "
    "shrinkage controls the rating and the bands stay visible.",
    "The equalised order is a counterfactual - no driver has truly driven "
    "identical machinery - and is the model's best estimate, not a measured result.",
]


def build(seasons=SEASONS, *, n_reps: int = 300, lam=None, verbose: bool = True) -> dict:
    m = pd.read_parquet(model_path(seasons))
    if verbose:
        print(f"Loaded {len(m):,} laps | seasons {sorted(m.Season.unique())}")

    fit = M.fit_model(m, lam=lam, verbose=verbose)
    if verbose:
        print(f"\nBootstrap ({n_reps} reps)...")
    bs = M.bootstrap(fit, m, n_reps=n_reps, verbose=verbose)
    if verbose:
        print("\nCareer arc...")
    arc = M.fit_arc(fit, m, verbose=verbose)

    rat = V.ratings(m, fit, bs)
    eq = V.equalise(m, fit, bs)
    hm = V.heatmap(m, fit)

    artifact = {
        "meta": {
            "codename": "APEX",
            "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "seasons": sorted(int(s) for s in m["Season"].unique()),
            "n_laps": int(len(m)),
            "n_drivers": len(fit.skill),
            "n_car_seasons": len(fit.car),
            "n_circuits": len(fit.circuit),
            "method": "two-way effects (ridge-penalised least squares); "
                      "driver + car-season shrunk, circuit fixed; sign convention "
                      "higher = faster",
            "lambda": {"car": fit.lam[0], "driver": fit.lam[1]},
            "r2": round(fit.r2, 4),
            "bootstrap_reps": bs.n_reps,
            "connected": rat["network"]["connected"],
            "reference_circuit": eq["reference_circuit"],
            "reference_lap_seconds": eq["reference_lap_seconds"],
        },
        "drivers": rat["drivers"],
        "driver_seasons": rat["driver_seasons"],
        "cars": rat["cars"],
        "network": rat["network"],
        "unrated": rat["unrated"],
        "equalise": eq,
        "heatmap": hm,
        "career": arc,
        "driver_covariance": V.driver_covariance(bs),
        "constructor_colors": V.constructor_palette(),
        "limitations": LIMITATIONS,
    }
    return artifact


def write(artifact: dict, *, verbose: bool = True) -> None:
    served = REPO / "frontend" / "public" / "data" / "apex.json"
    copy = REPO / "analysis" / "apex.json"
    payload = json.dumps(artifact, separators=(",", ":"), ensure_ascii=False)
    served.parent.mkdir(parents=True, exist_ok=True)
    for p in (served, copy):
        p.write_text(payload, encoding="utf-8")
    kb = len(payload.encode("utf-8")) / 1024
    if verbose:
        print(f"\nWrote apex.json ({kb:.0f} KB) to:")
        print(f"  {served.relative_to(REPO)}")
        print(f"  {copy.relative_to(REPO)}")
    if kb > 1024:
        print(f"  WARNING: artifact exceeds 1 MB ({kb:.0f} KB)")


def main():
    write(build())


if __name__ == "__main__":
    main()
