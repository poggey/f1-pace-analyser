#!/usr/bin/env python
"""Verification harness for apex.json — the checks from the build plan.

Run after building: fails loud (non-zero exit) if any contract or face-validity
check breaks, so the dashboard never builds on a broken artifact.
"""

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ART = REPO / "frontend" / "public" / "data" / "apex.json"


def main() -> int:
    a = json.loads(ART.read_text())
    ok, fail = [], []

    def check(name, cond, detail=""):
        (ok if cond else fail).append(f"{name}: {detail}")

    # 1. connectivity — champions must be rated
    rated = {d["code"] for d in a["drivers"]}
    check("connected", a["network"]["connected"], f"components={a['network']['n_components']}")
    for c in ["VER", "PER", "LEC", "SAI", "HAM"]:
        check(f"rated:{c}", c in rated, "present" if c in rated else "MISSING")
    check("no_unrated", len(a["unrated"]) == 0, f"unrated={a['unrated']}")

    # 2. face validity — skill ordering
    sk = {d["code"]: d["skill"] for d in a["drivers"]}
    check("VER_fastest", max(sk, key=sk.get) == "VER", f"top={max(sk, key=sk.get)}")
    top6 = [d["code"] for d in a["drivers"][:6]]
    elite = {"VER", "LEC", "HAM", "ALO", "NOR", "SAI", "RUS", "PIA"}
    check("top6_elite", len(set(top6) & elite) >= 5, f"top6={top6}")
    slow = {d["code"] for d in a["drivers"][-5:]}
    check("slowest_plausible", len(slow & {"MAZ", "LAT", "SAR", "DEV", "KUB", "GIO"}) >= 3,
          f"bottom5={sorted(slow)}")

    # teammate battles (career skill deltas, same team)
    def gap(a_, b_):
        return round(sk[a_] - sk[b_], 3)
    check("VER>>PER", sk["VER"] - sk["PER"] > 0.3, f"delta={gap('VER','PER')}")
    check("ALO>STR", sk["ALO"] > sk["STR"], f"delta={gap('ALO','STR')}")

    # 3. equalise — leader gap 0, monotone non-negative gaps
    order = a["equalise"]["order"]
    check("equalise_leader", order[0]["gap_seconds"] == 0.0, f"leader={order[0]['code']}")
    gaps = [o["gap_seconds"] for o in order]
    check("equalise_monotone", all(x <= y + 1e-9 for x, y in zip(gaps, gaps[1:])),
          "sorted ascending")
    check("equalise_top_elite", order[0]["code"] == "VER", f"p1={order[0]['code']}")

    # 4. artifact contract
    size_kb = len(ART.read_bytes()) / 1024
    check("under_1mb", size_kb < 1024, f"{size_kb:.0f} KB")
    for d in a["drivers"]:
        lo, hi = d["skill_ci"]
        if not (lo < hi and lo <= d["skill"] <= hi):
            fail.append(f"ci_bad:{d['code']} skill={d['skill']} ci={d['skill_ci']}")
            break
    else:
        ok.append("driver_ci_valid: all lo<skill<hi")
    hm = a["heatmap"]
    check("heatmap_dims", len(hm["values"]) == len(hm["drivers"])
          and all(len(r) == len(hm["circuits"]) for r in hm["values"]),
          f"{len(hm['drivers'])}x{len(hm['circuits'])}")
    cov = a["driver_covariance"]
    check("cov_square", len(cov["matrix"]) == len(cov["codes"])
          and all(len(r) == len(cov["codes"]) for r in cov["matrix"]),
          f"n={len(cov['codes'])}")
    check("career_present", len(a["career"]) == len(rated), f"{len(a['career'])} drivers")

    print("PASS:")
    for x in ok:
        print(f"  + {x}")
    if fail:
        print("\nFAIL:")
        for x in fail:
            print(f"  x {x}")
        return 1
    print(f"\nAll {len(ok)} checks passed. Artifact {size_kb:.0f} KB.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
