"""Stage 4.2 — the two-way effects model (transparent ridge-penalised OLS).

Every clean lap is ``PacePct = circuit + car-season + driver + noise``. The
design matrix is plain one-hot columns (intercept + circuit + car-season +
driver) and the solve is ridge-penalised least squares: circuit is the
unpenalised fixed baseline, driver and car effects are L2-shrunk toward zero
(the transparent equal of a random-effects model — a rookie with three laps is
pulled to the field mean until the data earns a stronger claim). A tiny ridge
on every column (``RIDGE_EPS``) resolves the harmless intercept-vs-dummies
collinearity so ``X'X`` is always invertible.

Identification conventions (absorbed into the intercept, residuals unchanged):
  - driver effects: laps-weighted mean zero (the field-average *lap* is zero)
  - car effects:    plain mean zero (relative to the average car)

``build_network()`` builds the teammate/transfer graph (drivers are nodes; an
edge means two drivers shared the same car-season, weighted by how many they
shared) and keeps the largest connected component; anyone outside it cannot be
separated from their car and is flagged ``unrated`` instead of guessed.

``bootstrap()`` resamples whole *sessions* with replacement and refits, giving
percentile confidence intervals and the driver-effect covariance the
head-to-head view needs. ``fit_arc()`` adds a heavily shrunk per-season
deviation on top of the career skill for the career-arc view (a plain
per-driver-season model would re-break the network, so the career term is the
anchor).

Sign convention: effects are in PacePct units where positive = slower.
Views negate them so that higher = faster.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import networkx as nx
import numpy as np
import pandas as pd

# Default L2 penalty (car, driver) in PacePct^2 units.
LAMBDA = (20.0, 20.0)
# Tiny ridge on every column (incl. intercept + circuit) for invertibility.
RIDGE_EPS = 1e-8
# Heavier shrinkage (2x the driver penalty) for the per-season arc deviations.
LAMBDA_ARC = 40.0
# Session bootstrap defaults.
N_REPS = 300
SEED = 42


# --------------------------------------------------------------------------- #
# teammate / transfer network
# --------------------------------------------------------------------------- #

@dataclass
class Network:
    largest: set[str]                     # drivers in the largest component
    components: list[set[str]]            # all components, largest first
    edges: list[tuple[str, str, int]]     # (a, b, shared car-seasons)
    unrated: list[str]                    # drivers outside the largest


def _car_season(m: pd.DataFrame) -> pd.Series:
    return m["Team"].astype(str) + " " + m["Season"].astype(str)


def build_network(m: pd.DataFrame) -> Network:
    """Drivers are nodes; sharing a car-season is an edge (weight = count)."""
    cs = _car_season(m)
    g = nx.Graph()
    g.add_nodes_from(m["Driver"].unique())
    for _, group in m.groupby(cs):
        codes = sorted(group["Driver"].unique())
        for i, a in enumerate(codes):
            for b in codes[i + 1:]:
                w = g.edges[a, b]["weight"] + 1 if g.has_edge(a, b) else 1
                g.add_edge(a, b, weight=w)
    components = sorted(nx.connected_components(g), key=len, reverse=True)
    largest = set(components[0]) if components else set()
    edges = sorted((a, b, d["weight"]) if a < b else (b, a, d["weight"])
                   for a, b, d in g.edges(data=True))
    unrated = sorted(set(m["Driver"].unique()) - largest)
    return Network(largest=largest, components=[set(c) for c in components],
                   edges=edges, unrated=unrated)


# --------------------------------------------------------------------------- #
# the fit
# --------------------------------------------------------------------------- #

@dataclass
class Fit:
    skill: dict[str, float]               # driver -> skill (= -effect)
    driver: dict[str, float]              # driver -> effect (PacePct)
    car: dict[str, float]                 # car-season -> effect (PacePct)
    circuit: dict[str, float]             # circuit -> effect (PacePct)
    intercept: float
    lam: tuple[float, float]              # (car, driver)
    r2: float
    laps: dict[str, dict[str, int]]       # {"driver": {...}, "car": {...}}
    network: Network
    resid: np.ndarray                     # aligned with the rated frame
    # kept for the bootstrap (not serialised)
    rated: pd.DataFrame = field(repr=False, default=None)


def _design(rated: pd.DataFrame):
    """One-hot design: intercept + circuit + car-season + driver."""
    circuits = sorted(rated["EventName"].unique())
    cars = sorted(rated["CarSeason"].unique())
    drivers = sorted(rated["Driver"].unique())

    n = len(rated)
    cols = 1 + len(circuits) + len(cars) + len(drivers)
    X = np.zeros((n, cols))
    X[:, 0] = 1.0
    ci = {c: 1 + i for i, c in enumerate(circuits)}
    ca = {c: 1 + len(circuits) + i for i, c in enumerate(cars)}
    dr = {d: 1 + len(circuits) + len(cars) + i for i, d in enumerate(drivers)}
    X[np.arange(n), rated["EventName"].map(ci).to_numpy()] = 1.0
    X[np.arange(n), rated["CarSeason"].map(ca).to_numpy()] = 1.0
    X[np.arange(n), rated["Driver"].map(dr).to_numpy()] = 1.0
    return X, circuits, cars, drivers


def _solve(X: np.ndarray, y: np.ndarray, n_circ: int, n_car: int, n_drv: int,
           lam: tuple[float, float]) -> np.ndarray:
    """Ridge-penalised normal equations. Circuit block gets only RIDGE_EPS."""
    penalty = np.full(X.shape[1], RIDGE_EPS)
    penalty[1 + n_circ: 1 + n_circ + n_car] += lam[0]        # cars
    penalty[1 + n_circ + n_car:] += lam[1]                   # drivers
    XtX = X.T @ X + np.diag(penalty)
    return np.linalg.solve(XtX, X.T @ y)


def _effects(rated: pd.DataFrame, lam: tuple[float, float]):
    """Fit on a (rated) frame and return centred effect dicts + residuals."""
    X, circuits, cars, drivers = _design(rated)
    y = rated["PacePct"].to_numpy()
    beta = _solve(X, y, len(circuits), len(cars), len(drivers), lam)

    resid = y - X @ beta
    intercept = beta[0]
    circ = dict(zip(circuits, beta[1:1 + len(circuits)]))
    car = dict(zip(cars, beta[1 + len(circuits):1 + len(circuits) + len(cars)]))
    drv = dict(zip(drivers, beta[1 + len(circuits) + len(cars):]))

    # identification: absorb the effect means into the intercept
    drv_laps = rated["Driver"].value_counts()
    d_shift = float(np.average([drv[d] for d in drivers],
                               weights=[drv_laps[d] for d in drivers]))
    c_shift = float(np.mean(list(car.values())))
    drv = {d: v - d_shift for d, v in drv.items()}
    car = {c: v - c_shift for c, v in car.items()}
    intercept += d_shift + c_shift
    return drv, car, circ, intercept, resid


def fit_model(m: pd.DataFrame, lam: tuple[float, float] | None = None,
              verbose: bool = True) -> Fit:
    """Two-way effects fit on the connected (rated) part of the grid."""
    lam = tuple(lam) if lam is not None else LAMBDA
    net = build_network(m)
    rated = m[m["Driver"].isin(net.largest)].reset_index(drop=True).copy()
    rated["CarSeason"] = _car_season(rated)

    drv, car, circ, intercept, resid = _effects(rated, lam)
    y = rated["PacePct"].to_numpy()
    r2 = 1.0 - float(resid @ resid) / float(((y - y.mean()) ** 2).sum())

    if verbose:
        print(f"Fit: {len(rated):,} laps | {len(drv)} drivers | "
              f"{len(car)} car-seasons | {len(circ)} circuits | "
              f"lambda(car,driver)={lam} | R^2={r2:.4f}")
        if net.unrated:
            print(f"  unrated (outside network): {net.unrated}")

    return Fit(
        skill={d: -v for d, v in drv.items()},
        driver=drv, car=car, circuit=circ, intercept=intercept,
        lam=lam, r2=r2,
        laps={"driver": rated["Driver"].value_counts().to_dict(),
              "car": rated["CarSeason"].value_counts().to_dict()},
        network=net, resid=resid, rated=rated,
    )


# --------------------------------------------------------------------------- #
# session bootstrap
# --------------------------------------------------------------------------- #

@dataclass
class Bootstrap:
    n_reps: int
    driver_ci: dict[str, tuple[float, float]]   # effect CIs (2.5, 97.5 pct)
    car_ci: dict[str, tuple[float, float]]
    driver_cov: pd.DataFrame                    # effect covariance


def _session_resample(rated: pd.DataFrame, rng: np.random.Generator) -> pd.DataFrame:
    """Resample whole sessions (Season, Round) with replacement."""
    sessions = list(rated.groupby(["Season", "Round"]).groups.values())
    picks = rng.integers(0, len(sessions), size=len(sessions))
    return rated.loc[np.concatenate([sessions[i] for i in picks])].reset_index(drop=True)


def bootstrap(fit: Fit, m: pd.DataFrame, n_reps: int = N_REPS,
              verbose: bool = True) -> Bootstrap:
    """Percentile CIs + driver covariance from a whole-session bootstrap."""
    rng = np.random.default_rng(SEED)
    drivers = sorted(fit.driver)
    cars = sorted(fit.car)
    drv_reps = pd.DataFrame(np.nan, index=range(n_reps), columns=drivers)
    car_reps = pd.DataFrame(np.nan, index=range(n_reps), columns=cars)

    for r in range(n_reps):
        boot = _session_resample(fit.rated, rng)
        drv, car, *_ = _effects(boot, fit.lam)
        for d, v in drv.items():
            if d in drv_reps.columns:
                drv_reps.loc[r, d] = v
        for c, v in car.items():
            if c in car_reps.columns:
                car_reps.loc[r, c] = v
        if verbose and (r + 1) % 50 == 0:
            print(f"  bootstrap {r + 1}/{n_reps}")

    def ci(col: pd.Series) -> tuple[float, float]:
        lo, hi = np.nanpercentile(col, [2.5, 97.5])
        return float(lo), float(hi)

    return Bootstrap(
        n_reps=n_reps,
        driver_ci={d: ci(drv_reps[d]) for d in drivers},
        car_ci={c: ci(car_reps[c]) for c in cars},
        driver_cov=drv_reps.cov(),
    )


# --------------------------------------------------------------------------- #
# career arc
# --------------------------------------------------------------------------- #

def _arc_effects(frame: pd.DataFrame, lam: tuple[float, float]) -> dict[tuple[str, int], float]:
    """Joint refit with per driver-season deviation columns.

    Same design as the career fit plus one column per driver-season, penalised
    ``LAMBDA_ARC`` (heavier than the career driver penalty) so thin seasons
    collapse to the career line instead of swinging wildly. Per-season skill is
    the centred career effect plus its season deviation, negated (higher =
    faster).
    """
    X, circuits, cars, drivers = _design(frame)
    ds_keys = sorted(set(zip(frame["Driver"], frame["Season"])))
    ds_idx = {k: i for i, k in enumerate(ds_keys)}
    D = np.zeros((len(frame), len(ds_keys)))
    D[np.arange(len(frame)),
      [ds_idx[(d, s)] for d, s in zip(frame["Driver"], frame["Season"])]] = 1.0
    Xj = np.hstack([X, D])
    y = frame["PacePct"].to_numpy()

    n_circ, n_car, n_drv = len(circuits), len(cars), len(drivers)
    penalty = np.full(Xj.shape[1], RIDGE_EPS)
    penalty[1 + n_circ: 1 + n_circ + n_car] += lam[0]                 # cars
    penalty[1 + n_circ + n_car: 1 + n_circ + n_car + n_drv] += lam[1]  # drivers
    penalty[1 + n_circ + n_car + n_drv:] += LAMBDA_ARC                # deviations
    beta = np.linalg.solve(Xj.T @ Xj + np.diag(penalty), Xj.T @ y)

    drv = dict(zip(drivers, beta[1 + n_circ + n_car: 1 + n_circ + n_car + n_drv]))
    dev = dict(zip(ds_keys, beta[1 + n_circ + n_car + n_drv:]))
    counts = frame["Driver"].value_counts()
    d_shift = float(np.average([drv[d] for d in drivers],
                               weights=[counts[d] for d in drivers]))
    return {(code, int(season)): -(drv[code] - d_shift) - dev[(code, season)]
            for code, season in ds_keys}


def fit_arc(fit: Fit, m: pd.DataFrame, verbose: bool = True,
            n_reps: int = N_REPS) -> dict:
    """Career arc: per-season skill with CIs from a session bootstrap.

    Point estimates come from the joint career+deviation refit; CIs re-run
    that whole refit on resampled sessions, so they carry both the career
    uncertainty and the season deviation's.
    """
    rated = fit.rated
    point = _arc_effects(rated, fit.lam)

    rng = np.random.default_rng(SEED + 1)
    reps: dict[tuple[str, int], list[float]] = {}
    for r in range(n_reps):
        boot = _session_resample(rated, rng)
        for key, val in _arc_effects(boot, fit.lam).items():
            reps.setdefault(key, []).append(val)
        if verbose and (r + 1) % 50 == 0:
            print(f"  arc bootstrap {r + 1}/{n_reps}")

    laps = rated.groupby(["Driver", "Season"]).size()
    arc: dict[str, list[dict]] = {}
    for code, season in sorted(point):
        vals = reps.get((code, season), [])
        ci = None
        if len(vals) >= 20:
            lo, hi = np.percentile(vals, [2.5, 97.5])
            ci = [float(lo), float(hi)]
        arc.setdefault(code, []).append({
            "season": season,
            "skill": float(point[(code, season)]),
            "ci": ci,
            "laps": int(laps[(code, season)]),
        })
    if verbose:
        print(f"Arc: {sum(len(v) for v in arc.values())} driver-season points")
    return arc
