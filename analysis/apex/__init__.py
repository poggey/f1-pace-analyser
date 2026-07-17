"""APEX — pace decomposition pipeline.

Small, reusable functions behind the narrated notebook (``analysis/explore.ipynb``)
and the headless artifact builder (``analysis/build_artifact.py``). Each module maps
to one stage of the white paper pipeline:

    ingest    -> Stage 1   (pull qualifying laps from FastF1)
    clean     -> Stage 2   (keep only genuine flying laps)
    normalise -> Stage 3   (% gap to session best + 107% trim)
    teams     -> display/colour canonicalisation (historical team names)
    model     -> Stage 4.2 (two-way effects, network, bootstrap)
    views     -> Stage 5   (constellation / equalise / heatmap / career / H2H)
    build     -> Stage 6   (assemble + write apex.json)
"""

from pathlib import Path

__all__ = ["find_repo_root", "REPO", "CACHE", "PARQUET", "SEASONS"]

# The seasons APEX models. 2018-2024 is the white paper scope; the earlier
# seasons are what connect Red Bull and Ferrari into the teammate network via
# driver transfers (SAI, ALB, VET, RIC, ...).
SEASONS = (2018, 2019, 2020, 2021, 2022, 2023, 2024)


def find_repo_root(start: Path | None = None) -> Path:
    """Walk up the folder tree until we find WHITEPAPER.md (the repo marker)."""
    p = (start or Path.cwd()).resolve()
    while p != p.parent:
        if (p / "WHITEPAPER.md").exists():
            return p
        p = p.parent
    raise RuntimeError("repo root not found (no WHITEPAPER.md above cwd)")


REPO = find_repo_root(Path(__file__).parent)
CACHE = REPO / "data" / "cache"        # FastF1's download cache
PARQUET = REPO / "data" / "parquet"    # our own intermediate tables
CACHE.mkdir(parents=True, exist_ok=True)
PARQUET.mkdir(parents=True, exist_ok=True)
