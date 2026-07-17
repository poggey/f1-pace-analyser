"use client";

import { useMemo, useState } from "react";
import type { Apex } from "@/lib/apex";
import { lapTime, secs } from "@/lib/apex";
import { ViewHeader } from "@/components/ui";

export default function Equalise({ data }: { data: Apex }) {
  const { equalise: eq } = data;
  const [carId, setCarId] = useState(eq.default_reference);

  const car = eq.reference_cars.find((c) => c.car_season === carId) ?? eq.reference_cars[0];
  const scale = car.lap_seconds / eq.reference_lap_seconds;

  // reference cars fastest-first for the selector
  const cars = useMemo(
    () => [...eq.reference_cars].sort((a, b) => a.lap_seconds - b.lap_seconds),
    [eq.reference_cars],
  );

  const rows = eq.order.map((o) => ({ ...o, gap: o.gap_seconds * scale }));
  const half = Math.ceil(rows.length / 2);
  const cols = [rows.slice(0, half), rows.slice(half)];

  return (
    <div>
      <ViewHeader
        marker="02"
        title="Equalise the Grid"
        right={
          <div className="flex flex-col items-end gap-1">
            <label className="eyebrow">Reference car</label>
            <select
              value={carId}
              onChange={(e) => setCarId(e.target.value)}
              className="mono w-56 rounded border border-hairline bg-panel2 px-3 py-2 text-[13px] text-paper outline-none focus:border-f1red"
            >
              {cars.map((c) => (
                <option key={c.car_season} value={c.car_season} className="bg-panel2">
                  {c.team} {c.season} — {lapTime(c.lap_seconds)}
                </option>
              ))}
            </select>
          </div>
        }
      >
        Drop every driver into the same car and the finishing order collapses to skill
        alone. Change the car and the whole field&rsquo;s clock drifts together — but the
        order never moves, which is the entire point.
      </ViewHeader>

      {/* Reference readout */}
      <div className="mb-5 flex flex-wrap items-stretch gap-3">
        <div className="flex items-center gap-4 rounded-lg border border-hairline bg-panel px-5 py-3.5">
          <span className="h-9 w-1 rounded-sm" style={{ background: car.color }} />
          <div>
            <p className="eyebrow">Leader lap · {car.team} {car.season}</p>
            <p className="slant mono text-3xl font-bold leading-tight text-paper">
              {lapTime(car.lap_seconds)}
            </p>
          </div>
        </div>
        <div className="flex items-center rounded-lg border border-hairline bg-panel px-5 py-3.5">
          <div>
            <p className="eyebrow">Neutral circuit</p>
            <p className="mono mt-1 text-[15px] text-paper">{eq.reference_circuit}</p>
          </div>
        </div>
        <div className="flex flex-1 items-center rounded-lg border border-hairline bg-panel px-5 py-3.5">
          <p className="text-[12px] leading-relaxed text-mute">
            Gaps are the per-lap skill deltas in this car; a full-race spread of a few
            seconds. Bands are the bootstrap 95% interval.
          </p>
        </div>
      </div>

      {/* Tower */}
      <div className="grid gap-x-8 gap-y-0 lg:grid-cols-2">
        {cols.map((col, ci) => (
          <div key={ci} className="rounded-lg border border-hairline bg-panel">
            {col.map((r, i) => {
              const pos = ci * half + i + 1;
              const leader = pos === 1;
              const maxGap = rows[rows.length - 1].gap || 1;
              return (
                <div
                  key={r.code}
                  className="relative flex items-center gap-3 border-b border-hairline/70 px-3 py-2.5 last:border-b-0"
                >
                  {/* rank */}
                  <span className={`mono w-6 text-right text-[13px] ${leader ? "text-f1red" : "text-mute2"}`}>
                    {pos}
                  </span>
                  {/* team flash */}
                  <span className="h-6 w-[3px] shrink-0 rounded-sm" style={{ background: r.color }} />
                  {/* code + name */}
                  <span className="mono w-10 text-[14px] font-medium text-paper">{r.code}</span>
                  <span className="hidden truncate text-[12px] text-mute sm:block">{r.name}</span>
                  {/* gap bar */}
                  <span className="ml-auto flex items-center gap-3">
                    <span className="hidden h-1 w-24 overflow-hidden rounded-full bg-panel2 md:block">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${(r.gap / maxGap) * 100}%`, background: leader ? "var(--color-cyan)" : r.color }}
                      />
                    </span>
                    <span className={`mono w-20 text-right text-[13px] ${leader ? "text-cyan" : "text-paper"}`}>
                      {leader ? "LEADER" : secs(r.gap)}
                    </span>
                  </span>
                  {leader && <span className="absolute inset-y-0 left-0 w-[2px] bg-f1red" />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
