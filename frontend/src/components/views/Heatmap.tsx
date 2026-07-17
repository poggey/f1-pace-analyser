"use client";

import { useMemo, useState } from "react";
import * as d3 from "d3";
import type { Apex } from "@/lib/apex";
import { ViewHeader } from "@/components/ui";

function shortCircuit(name: string): string {
  const base = name.replace(/Grand Prix/i, "").trim();
  const words = base.split(/\s+/);
  if (words.length > 1) return words.map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  return base.slice(0, 3).toUpperCase();
}

export default function Heatmap({ data }: { data: Apex }) {
  const { heatmap: hm, drivers } = data;
  const [cell, setCell] = useState<{ r: number; c: number } | null>(null);

  // Order rows by skill (fastest at the top) using the drivers ranking.
  const rank = useMemo(() => {
    const m = new Map(drivers.map((d, i) => [d.code, i]));
    return hm.drivers
      .map((code, idx) => ({ code, idx }))
      .sort((a, b) => (m.get(a.code) ?? 99) - (m.get(b.code) ?? 99));
  }, [drivers, hm.drivers]);

  // Symmetric diverging domain from the robust spread of values.
  const flat = hm.values.flat().filter((v): v is number => v != null);
  const absMax = d3.quantile(flat.map(Math.abs).sort(d3.ascending), 0.96) ?? 3;
  const color = (v: number) => {
    const t = Math.max(-1, Math.min(1, v / absMax));
    if (t < 0) return d3.interpolateRgb("#141519", "#27f4d2")(-t); // faster than expected
    return d3.interpolateRgb("#141519", "#e10600")(t); // slower than expected
  };

  const CELL = 22;
  const LABEL = 46;

  return (
    <div>
      <ViewHeader marker="03" title="The Circuit Matrix">
        Where the constellation gives one number per driver, the matrix exposes the
        interaction — how each driver performs at each circuit relative to their{" "}
        <span className="text-paper">own baseline</span>. Cyan is faster than the model
        expects; <span className="text-f1red">red</span> is slower. Values in tenths per
        lap.
      </ViewHeader>

      <div className="rounded-lg border border-hairline bg-panel p-4">
        <div className="overflow-x-auto">
          <div style={{ width: LABEL + hm.circuits.length * CELL + 8 }}>
            {/* circuit header */}
            <div className="flex" style={{ marginLeft: LABEL }}>
              {hm.circuits.map((c, ci) => (
                <div
                  key={c}
                  className={`mono flex items-end justify-center text-[9px] ${
                    cell?.c === ci ? "text-paper" : "text-mute2"
                  }`}
                  style={{ width: CELL, height: 42 }}
                  title={c}
                >
                  <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                    {shortCircuit(c)}
                  </span>
                </div>
              ))}
            </div>

            {/* rows */}
            {rank.map(({ code, idx: ri }) => (
              <div key={code} className="flex items-center">
                <div
                  className={`mono shrink-0 pr-2 text-right text-[11px] ${
                    cell?.r === ri ? "text-paper" : "text-mute"
                  }`}
                  style={{ width: LABEL }}
                >
                  {code}
                </div>
                {hm.circuits.map((_, ci) => {
                  const v = hm.values[ri][ci];
                  const active = cell?.r === ri && cell?.c === ci;
                  return (
                    <div
                      key={ci}
                      onMouseEnter={() => setCell({ r: ri, c: ci })}
                      onMouseLeave={() => setCell(null)}
                      style={{
                        width: CELL,
                        height: CELL,
                        background: v == null ? "transparent" : color(v),
                        outline: active ? "1.5px solid #fff" : "none",
                        outlineOffset: -1,
                      }}
                      className="border border-carbon/60"
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* legend + readout */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-hairline pt-3">
          <div className="flex items-center gap-3">
            <span className="eyebrow text-cyan">Faster</span>
            <span
              className="h-2.5 w-40 rounded-full"
              style={{ background: `linear-gradient(90deg, #27f4d2, #141519, #e10600)` }}
            />
            <span className="eyebrow text-f1red">Slower</span>
            <span className="mono ml-2 text-[10px] text-mute2">
              ±{absMax.toFixed(1)} tenths/lap
            </span>
          </div>
          <div className="mono text-[12px] text-mute">
            {cell && hm.values[cell.r][cell.c] != null ? (
              <span>
                <span className="text-paper">{hm.drivers[cell.r]}</span>
                {" · "}
                {hm.circuits[cell.c]}
                {" · "}
                <span
                  className={hm.values[cell.r][cell.c]! < 0 ? "text-cyan" : "text-f1red"}
                >
                  {hm.values[cell.r][cell.c]! >= 0 ? "+" : "−"}
                  {Math.abs(hm.values[cell.r][cell.c]!).toFixed(2)}
                </span>
                {" tenths · "}
                {hm.counts[cell.r][cell.c]} laps
              </span>
            ) : (
              <span className="text-mute2">Hover a cell for the driver × circuit reading</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
