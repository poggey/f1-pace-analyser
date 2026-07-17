"""Stage 5 — derived views for the dashboard.

Turns a fitted model + bootstrap into the JSON-serialisable structures behind
each white paper view: constellation (ratings), equalise tower, circuit heatmap,
career arc, and head-to-head. Sign convention throughout: **higher = faster**.
  - driver skill      = -(driver effect)      (fastest driver has the highest skill)
  - car performance   = -(car-season effect)  (fastest car has the highest perf)
  - heatmap residual  : negative = faster than the model expects (overperformance)
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from . import teams
from .model import Fit, Bootstrap

# Full names for display (falls back to the 3-letter code when unknown).
NAMES = {
    "VER": "Max Verstappen", "HAM": "Lewis Hamilton", "LEC": "Charles Leclerc",
    "PER": "Sergio Pérez", "SAI": "Carlos Sainz", "NOR": "Lando Norris",
    "RUS": "George Russell", "ALO": "Fernando Alonso", "OCO": "Esteban Ocon",
    "GAS": "Pierre Gasly", "BOT": "Valtteri Bottas", "ZHO": "Zhou Guanyu",
    "MAG": "Kevin Magnussen", "HUL": "Nico Hülkenberg", "TSU": "Yuki Tsunoda",
    "ALB": "Alexander Albon", "STR": "Lance Stroll", "RIC": "Daniel Ricciardo",
    "PIA": "Oscar Piastri", "SAR": "Logan Sargeant", "DEV": "Nyck de Vries",
    "LAW": "Liam Lawson", "BEA": "Oliver Bearman", "COL": "Franco Colapinto",
    "DOO": "Jack Doohan",
    "VET": "Sebastian Vettel", "RAI": "Kimi Räikkönen", "GRO": "Romain Grosjean",
    "KVY": "Daniil Kvyat", "GIO": "Antonio Giovinazzi", "KUB": "Robert Kubica",
    "MSC": "Mick Schumacher", "MAZ": "Nikita Mazepin", "LAT": "Nicholas Latifi",
    "AIT": "Jack Aitken", "FIT": "Pietro Fittipaldi", "HAR": "Brendon Hartley",
    "SIR": "Sergey Sirotkin", "ERI": "Marcus Ericsson", "VAN": "Stoffel Vandoorne",
    "PON": "Robert Kubica", "PAL": "Jolyon Palmer",
}


def _name(code: str) -> str:
    return NAMES.get(code, code)


def _primary_team(m: pd.DataFrame, code: str) -> str:
    g = m[m["Driver"] == code]
    return g["Team"].value_counts().idxmax()


def _skill_ci(bs: Bootstrap, code: str):
    """Driver-effect CI -> skill CI (negate + swap: skill = -effect)."""
    lo, hi = bs.driver_ci[code]
    return [-hi, -lo]


def ratings(m: pd.DataFrame, fit: Fit, bs: Bootstrap) -> dict:
    """Constellation: per-driver career skill, per-car-season performance, network."""
    m = m.copy()
    m["CarSeason"] = m["Team"].astype(str) + " " + m["Season"].astype(str)

    drivers = []
    for code in sorted(fit.skill):
        team = _primary_team(m, code)
        lin = teams.lineage(team)
        seasons = sorted(int(s) for s in m.loc[m["Driver"] == code, "Season"].unique())
        drivers.append({
            "code": code, "name": _name(code),
            "team": teams.display_name(team), "lineage": lin,
            "color": teams.color(team),
            "laps": int(fit.laps["driver"].get(code, 0)),
            "seasons": seasons,
            "skill": round(fit.skill[code], 4),
            "skill_ci": [round(x, 4) for x in _skill_ci(bs, code)],
            "effect": round(fit.driver[code], 4),
        })
    drivers.sort(key=lambda d: d["skill"], reverse=True)

    cars = []
    for cs in sorted(fit.car):
        team, season = cs.rsplit(" ", 1)
        season = int(season)
        lo, hi = bs.car_ci.get(cs, (np.nan, np.nan))
        cars.append({
            "car_season": cs, "team": teams.display_name(team),
            "lineage": teams.lineage(team), "season": season,
            "color": teams.color(team, season),
            "laps": int(fit.laps["car"].get(cs, 0)),
            "perf": round(-fit.car[cs], 4),
            "perf_ci": [round(-hi, 4), round(-lo, 4)],
        })
    cars.sort(key=lambda c: (c["season"], -c["perf"]))

    # per driver-season points (constellation filtered by season + arc backbone)
    car_perf = {c["car_season"]: c for c in cars}
    driver_seasons = []
    for (code, season), g in m.groupby(["Driver", "Season"]):
        if code not in fit.skill:
            continue
        cs = g["CarSeason"].value_counts().idxmax()
        c = car_perf.get(cs)
        if c is None:
            continue
        driver_seasons.append({
            "code": code, "name": _name(code), "season": int(season),
            "team": c["team"], "lineage": c["lineage"], "color": c["color"],
            "laps": int(len(g)),
            "car_season": cs, "car_perf": c["perf"], "car_perf_ci": c["perf_ci"],
            "skill": round(fit.skill[code], 4),  # career skill (arc adds per-season)
        })
    driver_seasons.sort(key=lambda d: (d["season"], -d["skill"]))

    net = fit.network
    network = {
        "nodes": sorted(net.largest),
        "edges": [[a, b, w] for a, b, w in net.edges
                  if a in net.largest and b in net.largest],
        "connected": len(net.components) == 1,
        "n_components": len(net.components),
    }
    return {"drivers": drivers, "cars": cars, "driver_seasons": driver_seasons,
            "network": network, "unrated": net.unrated}


def equalise(m: pd.DataFrame, fit: Fit, bs: Bootstrap,
             reference_circuit: str | None = None) -> dict:
    """Everyone in the same car -> order collapses to skill. Gaps in seconds."""
    m = m.copy()
    # Neutral reference circuit: among circuits raced in most seasons, the one
    # whose median pole is closest to the field-wide median pole (a
    # representative mid-length track, not the shortest/longest).
    if reference_circuit is None:
        seasons_raced = m.groupby("EventName")["Season"].nunique()
        top = seasons_raced[seasons_raced >= seasons_raced.max() - 1].index
        pole = m[m["EventName"].isin(top)].groupby("EventName")["SessionBest"].median()
        target = float(m["SessionBest"].median())
        reference_circuit = (pole - target).abs().idxmin()
    base_lap = float(m.loc[m["EventName"] == reference_circuit, "SessionBest"].median())

    fastest_car = min(fit.car, key=fit.car.get)          # smallest effect = fastest
    min_car_eff = fit.car[fastest_car]

    reference_cars = []
    m["CarSeason"] = m["Team"].astype(str) + " " + m["Season"].astype(str)
    for cs in sorted(fit.car):
        team, season = cs.rsplit(" ", 1)
        lap = base_lap * (1 + (fit.car[cs] - min_car_eff) / 100)
        reference_cars.append({
            "car_season": cs, "team": teams.display_name(team), "season": int(season),
            "lineage": teams.lineage(team), "color": teams.color(team, int(season)),
            "lap_seconds": round(lap, 3),
        })
    reference_cars.sort(key=lambda c: c["lap_seconds"])

    leader = max(fit.skill, key=fit.skill.get)
    cov = bs.driver_cov
    order = []
    for code in sorted(fit.skill, key=lambda d: fit.skill[d], reverse=True):
        gap_pct = fit.skill[leader] - fit.skill[code]       # >= 0, in PacePct units
        # var of (effect_code - effect_leader) from bootstrap driver covariance
        try:
            var = (cov.loc[code, code] + cov.loc[leader, leader]
                   - 2 * cov.loc[code, leader])
            sd = float(np.sqrt(max(var, 0.0)))
        except KeyError:
            sd = 0.0
        gap_s = base_lap * gap_pct / 100
        ci = [round(base_lap * max(gap_pct - 1.96 * sd, 0) / 100, 3),
              round(base_lap * (gap_pct + 1.96 * sd) / 100, 3)]
        order.append({
            "code": code, "name": _name(code),
            "lineage": teams.lineage(_primary_team(m, code)),
            "color": teams.color(_primary_team(m, code)),
            "skill": round(fit.skill[code], 4),
            "gap_seconds": round(gap_s, 3), "gap_ci": ci,
        })
    return {
        "reference_circuit": reference_circuit,
        "reference_lap_seconds": round(base_lap, 3),
        "default_reference": fastest_car,
        "reference_cars": reference_cars,
        "order": order,
    }


def heatmap(m: pd.DataFrame, fit: Fit) -> dict:
    """Driver x circuit mean residual (tenths/lap). Negative = overperformance."""
    rated = m[m["Driver"].isin(fit.network.largest)].reset_index(drop=True)
    rated = rated.copy()
    rated["resid"] = fit.resid  # aligned: fit was built on this same rated frame order

    # tenths conversion per circuit uses that circuit's median pole (SessionBest)
    pole = rated.groupby("EventName")["SessionBest"].median()
    # keep circuits with a reasonable sample
    circuits = [c for c in sorted(rated["EventName"].unique())]
    drivers = sorted(fit.skill)

    cell = (rated.groupby(["Driver", "EventName"])
            .agg(resid=("resid", "mean"), n=("resid", "size")).reset_index())
    lookup = {(r.Driver, r.EventName): (r.resid, r.n) for r in cell.itertuples()}

    values, counts = [], []
    for d in drivers:
        row, crow = [], []
        for c in circuits:
            if (d, c) in lookup:
                resid, n = lookup[(d, c)]
                tenths = resid / 100 * float(pole[c]) * 10
                row.append(round(float(tenths), 3))
                crow.append(int(n))
            else:
                row.append(None)
                crow.append(0)
        values.append(row)
        counts.append(crow)
    return {"unit": "tenths_per_lap", "circuits": circuits, "drivers": drivers,
            "values": values, "counts": counts,
            "note": "observed minus model-predicted pace; negative = faster than "
                    "expected (overperformance), positive = slower (underperformance)."}


def constructor_palette() -> dict:
    return {lin: {"label": teams.LINEAGE_LABEL[lin], "color": hex_}
            for lin, hex_ in teams._LINEAGE_COLOR.items()}


def driver_covariance(bs: Bootstrap) -> dict:
    cov = bs.driver_cov
    codes = list(cov.columns)
    return {"codes": codes,
            "matrix": [[round(float(cov.iloc[i, j]), 6) for j in range(len(codes))]
                       for i in range(len(codes))]}
