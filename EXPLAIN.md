# Code Explanations

Running, plain-English walkthrough of the code as I build it — so I can explain
every file even where AI helped. (Newest entries at the bottom.)

---

## The `analysis/apex/` package (Stages 1–6, reusable)

Stages 1–3b started life hard-coded to 2023 in the notebook. To run all of
2018–2024 and regenerate the dashboard artifact without a notebook, I pulled the
logic into a small importable package. Each file is one stage; the notebook and
`build_artifact.py` just call them.

- **`__init__.py`** — finds the repo root (walks up to `WHITEPAPER.md`), sets the
  cache/parquet paths, and declares `SEASONS = 2018…2024`. The season list is the
  whole ballgame: earlier seasons carry the driver transfers that connect Red Bull
  and Ferrari to the rest of the grid.
- **`ingest.py`** — `load_qualifying(season)` loops the season schedule, loads each
  `"Q"` session (no telemetry/weather/messages — smaller + faster), tags every lap
  with Season/Round/EventName, and stacks them. A session that fails to load is
  printed and skipped, never silently dropped.
- **`clean.py`** — the same six filters as notebook Stage 2 (has a lap time, not an
  in/out-lap, not deleted, fully green track, FastF1-reliable), then slims to the
  ~10 columns that bear on pace and adds `LapTimeSeconds`.
- **`normalise.py`** — `normalise()` turns each lap into a % gap to its session best
  (scale-free across circuits); `trim()` applies the 107% rule (keep laps within 7%
  of pole), dropping the cool-down tail.
- **`teams.py`** — display-only: maps FastF1's season-varying team strings to a
  stable constructor lineage, a tidy name, and a colour (with era liveries — Renault
  yellow, Racing Point pink…). The *model* keeps cars per team-season, so renames
  never merge two different cars.
- **`data.py`** — glue: `build_model_dataset(seasons)` runs ingest→clean→normalise→
  trim and writes `laps_q_2018_2024_model.parquet`. It's **resumable** — each season's
  raw laps are cached to their own parquet, so an interrupted download only re-pulls
  what's missing.
- **`model.py`** — Stage 4.2. Builds a one-hot design matrix (intercept + circuit +
  car-season + driver) and solves ridge-penalised least squares: circuit is the
  unpenalised fixed baseline, driver and car effects are L2-shrunk (the transparent
  equal of a random-effects model). `build_network()` builds the teammate/transfer
  graph and finds the connected component; anyone outside it is flagged `unrated`.
  `bootstrap()` resamples whole *sessions* with replacement and refits ~300 times to
  get confidence intervals and the driver covariance. `fit_arc()` adds a heavily
  shrunk per-season deviation on top of the career skill for the career-arc view
  (a plain per-driver-season model would re-break the network, so the career term is
  the anchor). A tiny ridge on every column (`RIDGE_EPS`) resolves the harmless
  intercept-vs-dummies collinearity so `X'X` is always invertible.
- **`views.py`** — Stage 5. Turns the fit into the dashboard's structures: ratings
  (constellation), equalise (skill-only order + second-gaps), heatmap (driver×circuit
  residuals in tenths), and the covariance for head-to-head. Sign convention is fixed
  here: higher = faster, everywhere.
- **`build.py`** — Stage 6. Assembles everything into one JSON dict and writes it to
  `frontend/public/data/apex.json` (plus a copy in `analysis/`), checking it stays
  under 1 MB. `analysis/build_artifact.py` is the headless entry point; the JSON
  contract is documented in `analysis/SCHEMA.md`.

**Why the model window is 2018–2024.** A quick connectivity check on 2021–2023 alone
returns four disconnected islands — Red Bull (VER/PER) and Ferrari (LEC/SAI) among
them — because no driver moved in or out of those teams in that window. You literally
cannot rank Verstappen against Hamilton from it. Reaching back to 2018 pulls in the
bridging transfers (Sainz, Albon, Vettel, Ricciardo…) and collapses the grid to a
single connected network, which is the whole precondition for the equalise view.
