# APEX — Driver Pace Analyser
### Pace Decomposition Engine · Technical White Paper

| | |
|---|---|
| **Codename** | APEX |
| **Class** | Analytics web app |
| **Data** | FastF1 / official F1 timing |
| **Model** | Two-way mixed-effects |
| **Seasons** | 2018 → 2024 |
| **Scope** | ~10 focused sessions |
| **Stack** | Next.js · FastAPI · statsmodels |
| **Revision** | v1.0 |

> A lap time is a confession of two things at once — how good the driver is, and how good the car is. **APEX pulls those two voices apart.**

It ingests seven seasons of timing data, normalises every lap against the field, and fits a two-way effects model that estimates a **skill rating** for each driver and a **performance rating** for each car — then lets you put the whole grid in identical machinery and watch the real order emerge.

---

## 01 — The Problem

### Lap times lie by omission.

*A stopwatch can tell you who was quickest. It cannot tell you why — and in Formula 1 the "why" is almost always the car.*

When Max Verstappen wins by twenty seconds, the timing screen credits the driver. But the same screen would have shown a slower number had he started the year in a midfield car, and a faster one in a dominant one. The observed lap time, `y`, is a sum of contributions that the clock never separates: the driver, the machine, the circuit, the conditions, and luck.

The hard part is that these contributions are **confounded**. A driver is only ever observed in the cars they actually drove, so the data alone cannot say whether a fast lap came from the hands or the chassis. This is not a quirk of motorsport — it is the same identification problem economists face when separating a worker's ability from the premium paid by their employer. The fix is the same too, and it is the thesis of this document.

| Metric | Value |
|---|---|
| Grands Prix | ~140 |
| Drivers observed | 40+ |
| Constructors | 12 |
| Qualifying laps | ~6,000 |

**What we are actually solving.** Given thousands of laps, recover two latent quantities — a per-driver skill effect and a per-car performance effect — such that, holding the car constant, the skill effects predict the order drivers *would* finish in. Everything in APEX is downstream of that one estimate.

---

## 02 — Methodology

### Two effects, one network.

*APEX treats pace as an additive model and leans on the structure of the grid — teammates and transfers — to make the two effects identifiable.*

### 2.1 — The data pipeline

FastF1 exposes the official F1 timing feed: lap-by-lap times, sector splits, tyre compound, track status and weather. Pulling it live is slow, so APEX runs a one-time ETL that caches every session to disk, then works entirely from the cache.

```
SRC          CLEAN          NORM            FIT             SERVE
FastF1   →   Lap        →   Normalise   →   Effects     →   Artifact
ingest       filtering     pace            model           (JSON)

• Pull every Q & race session, 2018–2024, into a parquet cache
• Drop in/out-laps, deleted laps, safety-car and wet-flagged runs
• Express each lap as % gap to session best — scale-free across circuits
• Estimate driver, car & circuit effects with shrinkage
• Persist coefficients + covariance as a compact JSON the API reads
```

**Why qualifying is the cleaner signal.** Qualifying is a single, low-fuel push lap with no traffic, no strategy and minimal tyre degradation — the closest thing F1 offers to a controlled test of pace. APEX uses qualifying as the primary signal and folds in **fuel- and degradation-corrected race-stint pace** as a secondary input, weighted lower, to add sample size without importing strategy noise.

### 2.2 — The model

For each clean lap we model the normalised pace as a sum of effects. A driver effect, a car effect that can move season-to-season, a circuit baseline, and noise:

```
y[d,c,k,s] = μ
           + α[d]      (driver skill)
           + β[c,s]    (car · season)
           + γ[k]      (circuit baseline)
           + ε[d,c,k,s] (residual)
```

Drivers and cars enter as **random effects**, fitted with `statsmodels` mixed linear models. Random effects apply shrinkage: a rookie with three races is pulled toward the field mean until the data earns a stronger claim, which keeps small samples from producing wild ratings. An equivalent ridge-penalised encoding gives the same regularisation when a fully Bayesian fit is overkill.

```python
# core fit — illustrative
import statsmodels.formula.api as smf

md = smf.mixedlm(
    "pace_pct ~ C(circuit)",          # γ_k fixed baseline
    data=laps,
    groups=laps["driver"],            # α_d random
    re_formula="1",
    vc_formula={"car": "0 + C(car_season)"}  # β_c,s variance component
)
res = md.fit(reml=True)
```

### 2.3 — Identification: the constellation network

Here is the crux. Driver and car effects are only separable because the grid is **connected**. Two teammates share a car but differ in skill — that pairing isolates the driver gap. A driver who transfers teams carries their skill estimate across, anchoring the new car. Chain enough of these together and the entire grid links into one component, identifiable up to a single global offset (fixed by setting the field-average driver to zero).

Plot drivers as nodes and teammate-pairings as edges and you get a literal constellation — the same network the scatter plot in §3 draws as hairlines between teammates. Any driver not connected to that network (a one-off substitute who never shared a measurable car) cannot be rated, and APEX flags them rather than guessing.

**Uncertainty is a first-class output.** Every rating ships with a confidence interval from the model's covariance, re-checked by a session-level bootstrap. The UI never shows a bare number — a driver with half a season carries a visibly wider band than one with seven years, and the product is honest about it.

---

## 03 — The Dashboard

### Built like a pit wall, not a website.

*APEX borrows the information design of an F1 broadcast: dense, tabular, monospaced numbers; constructor colours used only to encode data; a single red reserved for the brand and the racing line.*

### Design language

**Palette — constructor colours are data, not decoration.** The base canvas is carbon black; one Formula 1 red is spent on the brand and the racing line and nowhere else; constructor colours appear only where they encode a team.

| Token | Hex | Role |
|---|---|---|
| Carbon | `#0A0A0B` | Base canvas |
| Raised panel | `#0F1013` | Surfaces |
| Hairline | `#23262C` | Borders / grid |
| **F1 Red** | `#E10600` | Brand + racing line (single accent) |
| Paper | `#F2F3F5` | Primary text |
| Mute | `#8B9099` | Secondary text |
| Purple | `#B14BF4` | Timing: overall fastest |
| Green | `#1FD65F` | Timing: personal best |
| Yellow | `#F5C518` | Timing: slower / caution |
| Cyan | `#27F4D2` | Overperformance |

| Constructor | Hex | | Constructor | Hex |
|---|---|---|---|---|
| Red Bull | `#3671C6` | | Alpine | `#0093CC` |
| Ferrari | `#E8002D` | | Williams | `#64C4FF` |
| Mercedes | `#27F4D2` | | RB | `#6692FF` |
| McLaren | `#FF8000` | | Sauber | `#52E252` |
| Aston Martin | `#229971` | | Haas | `#B6BABD` |

**Type — Inter sets the voice, JetBrains Mono keeps the time.** Inter (heavy, tight tracking) carries display and UI; every measured quantity — lap times, gaps, ratings, coordinates — is set in tabular **JetBrains Mono** so digits align in columns the way they do on a real timing tower. Mono eyebrows are uppercase with wide letter-spacing; a subtle forward italic slant on the wordmark and section markers echoes the F1 speed motif.

---

### 3.1 — Driver Constellation `/ scatter`

The flagship view. Each driver is a point: horizontal axis is estimated skill, vertical axis is the quality of the car they drove. Points are coloured by constructor; **hairlines link teammates** to show the comparison network the model rides on. Dot radius is proportional to laps in sample. Where you sit relative to the diagonal "result-expectation line" tells the whole story — above it, the car is carrying you; below it, you are carrying the car.

```
  CAR ▲
  PERF │  FLATTERED BY CAR              ELITE · TOP MACHINERY
       │      · PER                        NOR · · VER
       │                              PIA·  ·LEC
       │                         RUS· ·HAM
       │                  STR·              ·ALO
       │              .·" result-expectation line
       │         .·"  MAG· ·HUL
       │    .·"        OCO··GAS
       │ STRUGGLING        ·ALB        PUNCHING ABOVE THE CAR
       └──────────────────────────────────────────────────▶
                              DRIVER SKILL
```

**Quadrant reading:**

- **Upper-right — Elite / top machinery.** High skill *and* a strong car.
- **Lower-right — Punching above the car.** High skill, weaker machinery; the driver the model says is being wasted.
- **Upper-left — Flattered by the car.** A strong car propping up a more modest skill estimate.
- **Lower-left — Struggling.** Weak on both axes.

The diagonal is the line where car and skill agree with the championship order — distance from it is the story APEX exists to tell.

*The interactive version of this chart, with live team-coloured dots and teammate hairlines, is in the accompanying HTML white paper.*

### 3.2 — Equalise the Grid `/ timing tower`

The counterfactual. Drop every driver into the same car and the finishing order collapses to skill alone. APEX renders it as a broadcast timing tower: position, constructor flash, three-letter code, and the predicted gap to the leader in tabular mono. Switching the chosen car changes the absolute clock — but **never the order**, which is exactly the point.

Illustrative equalised order (skill effect only, in a neutral 1:27-class reference car):

| Pos | Driver | Gap |
|---:|:---|---:|
| 1 | VER | LEADER |
| 2 | LEC | +0.045 |
| 3 | ALO | +0.045 |
| 4 | NOR | +0.054 |
| 5 | HAM | +0.063 |
| 6 | RUS | +0.090 |
| 7 | SAI | +0.099 |
| 8 | PIA | +0.108 |
| 9 | ALB | +0.144 |
| 10 | HUL | +0.153 |

> **Reference lap — 1:27.04s.** Predicted leader lap in the Red Bull RB20 at a neutral circuit. Choose a slower car and the whole field's clock drifts down together — the gaps between drivers hold, because skill is what they measure. Each delta is the lap-time penalty of that driver's skill effect relative to the fastest; `+0.063` means six hundredths slower per lap, about four seconds over a race.

*(Figures illustrative — not fitted results.)*

### 3.3 — Circuit Heatmap `/ matrix`

The third must-have. Where the constellation gives one number per driver, the heatmap exposes the interaction term — how each driver performs at each circuit *relative to their own baseline*. Street circuits reward different things than power tracks, and the matrix surfaces who has a Monaco gear and who comes alive at Spa. Cells run on a diverging scale: F1 red for underperformance, cyan for overperformance, values in tenths per lap.

Illustrative slice (Δ vs personal baseline, tenths/lap):

| DRV | MON | SPA | SIL | MNZ | SUZ | SGP | HUN | BHR |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|
| VER | +0.2 | +0.4 | +0.1 | +0.3 | +0.5 | +0.1 | +0.2 | +0.3 |
| LEC | +0.6 | −0.1 | 0.0 | +0.3 | −0.2 | +0.4 | −0.1 | +0.1 |
| HAM | −0.1 | +0.5 | +0.6 | −0.2 | +0.2 | −0.3 | +0.1 | 0.0 |
| ALO | +0.5 | +0.2 | −0.1 | 0.0 | +0.3 | +0.6 | +0.2 | −0.2 |
| NOR | −0.2 | +0.3 | +0.4 | +0.2 | +0.1 | −0.1 | +0.3 | +0.2 |
| RUS | 0.0 | −0.2 | +0.3 | +0.1 | −0.1 | +0.2 | 0.0 | +0.4 |
| PER | −0.4 | −0.1 | +0.1 | −0.2 | −0.3 | 0.0 | −0.2 | −0.1 |
| GAS | +0.1 | +0.4 | −0.2 | +0.5 | 0.0 | −0.2 | +0.3 | +0.1 |

### Nice-to-have views, same data spine

- **Career arc.** One driver's skill rating plotted season over season with its confidence band — does a driver improve, plateau, or get found out as the field changes?
- **Head-to-head comparator.** Two drivers, equalised, across every shared circuit — a direct teammate-style duel even between drivers who never shared a garage, bridged through the network.

---

## 04 — System Architecture

### Heavy lifting offline, instant on screen.

*The model is expensive to fit and cheap to read. APEX fits once, ships a small artifact, and serves everything from it.*

```
L0 · DATA            L1 · MODEL            L2 · API              L3 · UI
FastF1 cache    →    Fit & persist    →    FastAPI          →    Next.js + D3
(parquet)            (statsmodels)         (reads artifact)      (bespoke SVG)
```

- **L0 — Data.** Parquet store of all sessions. Refreshed per race weekend, never at request time.
- **L1 — Model.** statsmodels job emits coefficients, covariance and the interaction matrix as JSON.
- **L2 — API.** FastAPI reads the artifact. Equalise is a linear combination — milliseconds.
- **L3 — UI.** Bespoke SVG views. Static-rendered shell, data fetched client-side.

**Why Next.js + D3 over Streamlit or Dash.** The brief left the frontend open, and the design bar settles it. Streamlit and Dash are superb for getting a model on screen fast, but their stock components carry a recognisable look that fights the broadcast aesthetic this project is built around. The constellation, the timing tower and the heatmap are all bespoke SVG — that argues for **React with hand-built D3**, where every pixel is yours. Streamlit remains the right call for an internal model-debugging view, and it is worth standing one up early; it just is not the shipping surface.

**Deploy topology**

| Layer | Target | Notes |
|---|---|---|
| Frontend | Vercel | Next.js static + edge |
| API | Render | FastAPI service, reads model artifact |
| Model job | Render cron | Weekly re-fit after each round |
| Artifact | Object storage / bundled JSON | < 1 MB |

**API surface**

| Endpoint | Purpose |
|---|---|
| `GET /ratings?season=` | Driver & car effects with confidence intervals (constellation) |
| `POST /equalise` | Body picks a car; returns skill-only finishing order + gaps |
| `GET /heatmap?metric=` | Driver × circuit interaction matrix |
| `GET /driver/{code}` | Career arc series + head-to-head bridges |

---

## 05 — Build Roadmap (~10 focused sessions)

### From cache to constellation.

*Ten sessions, sequenced so something works end-to-end early and the design polish lands last, on top of a model you already trust.*

| # | Phase | Milestone | Detail |
|---|---|---|---|
| S1 | Setup | FastF1 ingest & cache | Wire FastF1, pull one season, build the parquet cache and a lap-cleaning function. Eyeball the data. |
| S2 | Data | Full backfill + normalisation | Backfill 2018–2024, implement %-gap-to-best normalisation, flag wet/SC sessions. |
| S3 | Model | First effects model | Fit the mixed model on qualifying. Sanity-check: does it rank teammates correctly? |
| S4 | Model | Identification & uncertainty | Build the teammate network, confirm connectivity, add bootstrap confidence intervals. |
| S5 | API | Artifact + FastAPI | Persist coefficients to JSON; stand up `/ratings` and `/equalise`. Throwaway Streamlit to verify. |
| S6 | UI | Next.js shell + design tokens | Lay the carbon HUD, Inter/Mono type scale, constructor palette. No charts yet — the chrome. |
| S7 | UI | The Constellation | Hand-build the D3 scatter: axes, teammate hairlines, confidence treatment, hover. |
| S8 | UI | Equalise tower + heatmap | Timing-tower order with the car selector; the driver × circuit matrix with diverging scale. |
| S9 | Feature | Career arc + head-to-head | The nice-to-haves, riding the same endpoints. Ship if time allows, scope down if not. |
| S10 | Ship | Polish & deploy | Motion pass, mobile, reduced-motion, copy. Deploy Vercel + Render. Write the methodology note. |

---

## 06 — Limitations & Honesty

### Where the model can be wrong.

*"Equal machinery" is a counterfactual, and counterfactuals extrapolate. APEX states its assumptions in the open rather than hiding them behind a confident number.*

- **In-season development.** A car's performance is not constant — upgrades move it mid-year. The β term is modelled per car-season; finer time resolution is a known extension, not a solved problem.
- **Driver–car fit.** Some drivers suit a car's characteristics better than others. The additive model assumes skill is portable; in reality a small, real interaction is folded into noise.
- **Disconnected drivers.** A one-off substitute who never shared a measurable car cannot be placed in the network. APEX flags them as unrated rather than guessing.
- **Wet & chaos laps.** Mixed-condition sessions are excluded, which is conservative but discards exactly the laps where driver skill matters most. A wet-specific model is future work.
- **Small samples.** Part-season and rookie drivers carry wide bands. Shrinkage controls the rating; the UI must keep the uncertainty visible so users don't over-read it.
- **The counterfactual itself.** No driver has ever truly driven identical machinery. The equalised order is the model's best estimate, not a measured result — and is labelled that way throughout.

---

## 07 — Appendix: Foundations

### Standing on prior art.

*The decomposition is not novel mathematics — it is a well-trodden method borrowed from a neighbouring field, which is exactly why it can be trusted.*

- **A1** — Two-way fixed-effects / AKM models: separating worker ability from firm premium in labour economics; the direct analogue for driver vs car.
- **A2** — Mixed linear models & shrinkage estimation: the statistical engine for regularising small-sample effects.
- **A3** — FastF1: Python access to official Formula 1 timing, telemetry and session data.
- **A4** — Percentage-off-pole normalisation: the standard scale-free pace metric across circuits of differing length.
- **A5** — Bipartite identification networks: connectivity as the condition for separability of two-way effects.

> **One-line summary (for the README):** APEX decomposes seven seasons of F1 lap times into a driver-skill rating and a car-performance rating using a two-way mixed-effects model identified by the teammate network — then lets you equalise the grid and see who is *actually* the fastest.

---

*APEX · Pace Decomposition Engine · White Paper v1.0 · Scope 2018–2024*
*Implementation notes: verify FastF1's data backend and API against current docs at S1; the `mixedlm` snippet is illustrative — a ridge-penalised OLS may be easier to reason about for the identification network before moving to the full mixed model. All driver/car/circuit figures shown are synthetic placeholders for layout, not fitted results.*
