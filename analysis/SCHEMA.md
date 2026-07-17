# apex.json — the dashboard artifact contract

One compact JSON, written by `analysis/apex/build.py` to
`frontend/public/data/apex.json` (served) and `analysis/apex.json` (a copy kept
beside the notebook). The dashboard fetches it client-side; there is no API.
Budget: **< 1 MB** (currently ~111 KB). Checked by `analysis/verify_artifact.py`.

**Sign convention everywhere: higher = faster.** Driver skill and car
performance are negated model effects, in units of *% of pole pace* (a skill of
`+0.59` means 0.59% faster than the field-average lap, ~0.5s on a 90s lap).
TypeScript mirror: `frontend/src/lib/apex.ts`.

## Top-level keys

| Key | Shape | Feeds |
|---|---|---|
| `meta` | object | header strip, methodology footer |
| `drivers` | array | constellation, head-to-head |
| `driver_seasons` | array | constellation (per-season dots) |
| `cars` | array | constellation (car axis), equalise selector |
| `network` | object | constellation hairlines, h2h bridge |
| `unrated` | array | honesty: drivers outside the network |
| `equalise` | object | timing tower |
| `heatmap` | object | circuit matrix |
| `career` | object | career arc |
| `driver_covariance` | object | head-to-head confidence |
| `constructor_colors` | object | legends |
| `limitations` | array of strings | methodology footer |

## `meta`

```jsonc
{
  "codename": "APEX",
  "generated": "2026-07-12T20:31:37+00:00",   // UTC ISO-8601
  "seasons": [2018, ..., 2024],
  "n_laps": 12270, "n_drivers": 40, "n_car_seasons": 71, "n_circuits": 36,
  "method": "two-way effects (ridge-penalised least squares); ...",
  "lambda": { "car": 20, "driver": 20 },       // L2 penalties
  "r2": 0.3557,
  "bootstrap_reps": 300,
  "connected": true,                            // teammate network is one component
  "reference_circuit": "Italian Grand Prix",    // neutral track for the tower
  "reference_lap_seconds": 79.457               // its median pole lap
}
```

## `drivers` — one entry per rated driver, sorted by skill (desc)

```jsonc
{
  "code": "VER", "name": "Max Verstappen",
  "team": "Red Bull Racing",        // most-frequent team (display only)
  "lineage": "red_bull",            // stable constructor key
  "color": "#3671C6",
  "laps": 713,
  "seasons": [2018, ..., 2024],
  "skill": 0.5878,                  // career skill, % of pole pace
  "skill_ci": [0.4995, 0.6808],     // 95% session-bootstrap percentile CI
  "effect": -0.5878                 // raw model effect (= -skill)
}
```

## `driver_seasons` — one entry per driver-season (constellation dots)

```jsonc
{
  "code": "VER", "name": "Max Verstappen", "season": 2018,
  "team": "Red Bull Racing", "lineage": "red_bull", "color": "#3671C6",
  "laps": 62,
  "car_season": "Red Bull Racing 2018",
  "car_perf": 0.5412, "car_perf_ci": [0.2474, 0.8659],
  "skill": 0.5878                   // career skill (the arc adds per-season)
}
```

## `cars` — one entry per car-season, sorted by (season, perf desc)

```jsonc
{
  "car_season": "Ferrari 2018", "team": "Ferrari", "lineage": "ferrari",
  "season": 2018, "color": "#E8002D", "laps": 169,
  "perf": 1.1142, "perf_ci": [0.8475, 1.3921]
}
```

## `network` — the identification structure

```jsonc
{
  "nodes": ["AIT", "ALB", ...],          // drivers in the largest component
  "edges": [["AIT", "LAT", 1], ...],     // [a, b, shared car-seasons]
  "connected": true,
  "n_components": 1
}
```

`unrated`: codes outside the largest component (flagged, never guessed).
Empty for 2018–2024.

## `equalise` — the counterfactual tower

```jsonc
{
  "reference_circuit": "Italian Grand Prix",
  "reference_lap_seconds": 79.457,
  "default_reference": "Red Bull Racing 2023",   // fastest car-season
  "reference_cars": [                            // selector, sorted fastest first
    { "car_season": "...", "team": "...", "season": 2023,
      "lineage": "...", "color": "#...", "lap_seconds": 79.457 }
  ],
  "order": [                                     // skill order, leader first
    { "code": "VER", "name": "...", "lineage": "...", "color": "#...",
      "skill": 0.5878,
      "gap_seconds": 0.0,                        // to the leader, at the reference lap
      "gap_ci": [0.0, 0.0] }                     // 95% CI from the driver covariance
  ]
}
```

Switching the reference car rescales the clock; the order never changes —
that is the point.

## `heatmap` — driver × circuit residuals

```jsonc
{
  "unit": "tenths_per_lap",
  "circuits": [...36 names...],       // columns, alphabetical
  "drivers": [...40 codes...],        // rows, alphabetical
  "values": [[+0.3, null, ...]],      // mean residual; null = never raced there
  "counts": [[5, 0, ...]],            // laps behind each cell
  "note": "observed minus model-predicted pace; negative = faster than expected ..."
}
```

**Heatmap sign is inverted vs everything else** (it is a residual): negative =
overperformance (cyan), positive = underperformance (red).

## `career` — the arc, keyed by driver code

```jsonc
{
  "VER": [
    { "season": 2018, "skill": 0.6108,          // career + shrunk season deviation
      "ci": [0.4907, 0.7352],                    // 95% bootstrap CI (null if too few reps)
      "laps": 62 },
    ...
  ]
}
```

## `driver_covariance` — bootstrap covariance of driver effects

```jsonc
{
  "codes": [...40, alphabetical...],
  "matrix": [[...40×40, symmetric...]]           // effect (not skill) covariance
}
```

Head-to-head: `var(a−b) = Σaa + Σbb − 2Σab` (negation cancels in differences).

## `constructor_colors`

```jsonc
{ "red_bull": { "label": "Red Bull", "color": "#3671C6" }, ... }
```

## `limitations`

Array of plain-English caveats, rendered verbatim in the methodology footer.
