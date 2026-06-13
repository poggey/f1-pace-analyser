# F1 Driver Pace Analyser

## Goal
A web app that decomposes Formula 1 lap times into pure driver skill vs car quality, 
letting users see who would actually be the fastest given equal machinery.


## Core question the tool answers
"Out of every F1 driver in the modern era, who is genuinely the most talented? 
Who overperforms relative to their car, and who underperforms?"

## Approach
Use teammate gaps as the controlled experiment — same car, same session, two 
different drivers. Chain these comparisons across the grid and seasons using 
regression to extract intrinsic driver pace.

## Data
- Source: FastF1 (Python library, official F1 timing data)
- Seasons: 2018–2024
- Granularity: lap-level data
- Cache locally to avoid re-downloading

## Stack
- Backend: Python (FastF1, pandas, statsmodels for regression)
- Frontend: open — recommend best option for premium dark-mode dashboard 
  aesthetic with interactive features
- Deployment: free hosting on a public URL

## Must-have features
1. Driver constellation scatter — driver skill vs car quality, all driver-seasons
2. Equalise the grid — pick a season + car, see predicted finishing order
3. Circuit specialist heatmap — driver vs circuit relative performance

## Nice-to-have features
- Career arc visualisations per driver
- Head-to-head comparator
- Filter by era / generation

## Design references
- Dark mode, F1 broadcast aesthetic
- Inter typeface for UI, JetBrains Mono for numbers
- F1 red (#e10600) as accent, team colours on data points
- Bloomberg Terminal / official F1 broadcast graphics inspiration

## Scope
- Working analytical model with sensible results
- Polished interactive UI
- Deployed live link
- README with screenshots

## What I want to learn
- Modern web development beyond Streamlit
- Sports analytics regression techniques
- How to write a quantitative analysis communicable in plain English