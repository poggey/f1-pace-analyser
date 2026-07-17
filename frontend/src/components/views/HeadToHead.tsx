"use client";

import { useMemo, useState } from "react";
import type { Apex, Driver } from "@/lib/apex";
import { pct } from "@/lib/apex";
import { ViewHeader } from "@/components/ui";

// Standard normal CDF via an erf approximation (Abramowitz & Stegun 7.1.26).
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

function shortestBridge(edges: [string, string, number][], a: string, b: string): string[] {
  const adj = new Map<string, string[]>();
  for (const [u, v] of edges) {
    (adj.get(u) ?? adj.set(u, []).get(u)!).push(v);
    (adj.get(v) ?? adj.set(v, []).get(v)!).push(u);
  }
  const q = [[a]];
  const seen = new Set([a]);
  while (q.length) {
    const path = q.shift()!;
    const last = path[path.length - 1];
    if (last === b) return path;
    for (const n of adj.get(last) ?? []) {
      if (!seen.has(n)) {
        seen.add(n);
        q.push([...path, n]);
      }
    }
  }
  return [];
}

function DriverSelect({
  drivers,
  value,
  onChange,
  align,
}: {
  drivers: Driver[];
  value: string;
  onChange: (v: string) => void;
  align: "left" | "right";
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`mono w-full rounded border border-hairline bg-panel2 px-3 py-2 text-[14px] text-paper outline-none focus:border-f1red ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {drivers.map((d) => (
        <option key={d.code} value={d.code} className="bg-panel2">
          {d.code} — {d.name}
        </option>
      ))}
    </select>
  );
}

export default function HeadToHead({ data }: { data: Apex }) {
  const drivers = data.drivers;
  const byCode = useMemo(() => new Map(drivers.map((d) => [d.code, d])), [drivers]);
  const [a, setA] = useState("VER");
  const [b, setB] = useState("HAM");

  const cov = data.driver_covariance;
  const idx = useMemo(() => new Map(cov.codes.map((c, i) => [c, i])), [cov.codes]);

  const A = byCode.get(a)!;
  const B = byCode.get(b)!;
  const ref = data.meta.reference_lap_seconds;

  const ia = idx.get(a);
  const ib = idx.get(b);
  const varA = ia != null ? cov.matrix[ia][ia] : 0;
  const varB = ib != null ? cov.matrix[ib][ib] : 0;
  const covAB = ia != null && ib != null ? cov.matrix[ia][ib] : 0;
  const sd = Math.sqrt(Math.max(varA + varB - 2 * covAB, 1e-9));

  const deltaSkill = A.skill - B.skill; // >0 => A faster (per-lap %)
  const gap = (ref * Math.abs(deltaSkill)) / 100; // seconds/lap
  const prob = normalCdf(deltaSkill / sd); // P(A faster)
  const faster = deltaSkill >= 0 ? A : B;
  const probFaster = Math.max(prob, 1 - prob) * 100;

  const bridge = useMemo(
    () => shortestBridge(data.network.edges, a, b),
    [data.network.edges, a, b],
  );

  return (
    <div>
      <ViewHeader marker="05" title="Head to Head">
        Any two drivers, equalised into the same car, across the whole network — a direct
        duel even between drivers who never shared a garage, bridged through their common
        teammates.
      </ViewHeader>

      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
        {/* A */}
        <div className="rounded-lg border border-hairline bg-panel p-5" style={{ borderTopColor: A.color, borderTopWidth: 3 }}>
          <DriverSelect drivers={drivers} value={a} onChange={setA} align="left" />
          <p className="mt-3 text-[12px] text-mute">{A.team}</p>
          <p className="slant mono mt-3 text-4xl font-bold text-paper">{pct(A.skill)}<span className="text-lg text-mute">%</span></p>
          <p className="eyebrow mt-1">Skill · 95% [{pct(A.skill_ci[0], 2)}, {pct(A.skill_ci[1], 2)}]</p>
          <p className="mono mt-3 text-[12px] text-mute2">{A.laps} laps · {A.seasons[0]}–{A.seasons[A.seasons.length - 1]}</p>
        </div>

        {/* delta */}
        <div className="flex min-w-[220px] flex-col items-center justify-center rounded-lg border border-hairline bg-panel2 px-6 py-6">
          <span className="eyebrow">Per-lap gap</span>
          <span className="slant mono mt-1 text-4xl font-extrabold text-cyan">{gap.toFixed(3)}s</span>
          <span className="mono mt-1 text-[11px] text-mute2">
            ±{((ref * 1.96 * sd) / 100).toFixed(3)}s
          </span>
          <div className="my-4 h-px w-full bg-hairline" />
          <span className="text-center text-[13px] text-mute">
            <span className="slant font-bold text-paper">{faster.code}</span> is faster
          </span>
          <span className="mono mt-1 text-2xl font-bold text-paper">{probFaster.toFixed(0)}%</span>
          <span className="eyebrow mt-0.5">confidence</span>
        </div>

        {/* B */}
        <div className="rounded-lg border border-hairline bg-panel p-5 text-right" style={{ borderTopColor: B.color, borderTopWidth: 3 }}>
          <DriverSelect drivers={drivers} value={b} onChange={setB} align="right" />
          <p className="mt-3 text-[12px] text-mute">{B.team}</p>
          <p className="slant mono mt-3 text-4xl font-bold text-paper">{pct(B.skill)}<span className="text-lg text-mute">%</span></p>
          <p className="eyebrow mt-1">Skill · 95% [{pct(B.skill_ci[0], 2)}, {pct(B.skill_ci[1], 2)}]</p>
          <p className="mono mt-3 text-[12px] text-mute2">{B.laps} laps · {B.seasons[0]}–{B.seasons[B.seasons.length - 1]}</p>
        </div>
      </div>

      {/* bridge */}
      <div className="mt-5 rounded-lg border border-hairline bg-panel p-5">
        <p className="eyebrow mb-3">Network bridge — how the comparison is identified</p>
        {a === b ? (
          <p className="text-[13px] text-mute2">Pick two different drivers.</p>
        ) : bridge.length ? (
          <div className="flex flex-wrap items-center gap-2">
            {bridge.map((code, i) => (
              <span key={code} className="flex items-center gap-2">
                {i > 0 && <span className="text-hairline2">—</span>}
                <span
                  className="mono rounded px-2 py-1 text-[12px]"
                  style={{
                    border: `1px solid ${byCode.get(code)?.color ?? "var(--color-hairline)"}`,
                    color: "var(--color-paper)",
                  }}
                >
                  {code}
                </span>
              </span>
            ))}
            <span className="mono ml-2 text-[11px] text-mute2">
              {bridge.length - 1} teammate link{bridge.length - 1 === 1 ? "" : "s"}
            </span>
          </div>
        ) : (
          <p className="text-[13px] text-mute2">No teammate path found.</p>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-mute2">
          Each link is a shared car-season. Chaining them lets the model compare drivers
          who never raced together — the confidence band above already folds in every
          step of the chain via the effect covariance.
        </p>
      </div>
    </div>
  );
}
