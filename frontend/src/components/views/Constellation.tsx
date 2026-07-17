"use client";

import { useMemo, useState } from "react";
import * as d3 from "d3";
import type { Apex, DriverSeason } from "@/lib/apex";
import { pct, readable } from "@/lib/apex";
import { useMeasure } from "@/lib/useMeasure";
import { ViewHeader } from "@/components/ui";

const HEIGHT = 620;
const M = { top: 28, right: 28, bottom: 48, left: 56 };

export default function Constellation({ data }: { data: Apex }) {
  const seasons = data.meta.seasons;
  const [season, setSeason] = useState(seasons[seasons.length - 1]);
  const [hover, setHover] = useState<string | null>(null);
  const { ref, width } = useMeasure<HTMLDivElement>();

  const rows = useMemo(
    () => data.driver_seasons.filter((d) => d.season === season),
    [data, season],
  );

  const w = Math.max(width, 320);
  const innerW = w - M.left - M.right;
  const innerH = HEIGHT - M.top - M.bottom;

  // Scales cover the full multi-season range so axes stay stable across seasons.
  const xExtent = d3.extent(data.driver_seasons, (d) => d.skill) as [number, number];
  const yExtent = d3.extent(data.driver_seasons, (d) => d.car_perf) as [number, number];
  const padX = (xExtent[1] - xExtent[0]) * 0.08;
  const padY = (yExtent[1] - yExtent[0]) * 0.1;

  const x = d3.scaleLinear().domain([xExtent[0] - padX, xExtent[1] + padX]).range([0, innerW]);
  const y = d3.scaleLinear().domain([yExtent[0] - padY, yExtent[1] + padY]).range([innerH, 0]);
  const r = d3.scaleSqrt().domain([0, d3.max(rows, (d) => d.laps) ?? 1]).range([3, 15]);

  // Teammate hairlines: driver-seasons sharing a car-season.
  const pairs = useMemo(() => {
    const byCar = d3.group(rows, (d) => d.car_season);
    const out: [DriverSeason, DriverSeason][] = [];
    for (const grp of byCar.values()) {
      for (let i = 0; i < grp.length; i++)
        for (let j = i + 1; j < grp.length; j++) out.push([grp[i], grp[j]]);
    }
    return out;
  }, [rows]);

  const xMid = (xExtent[0] + xExtent[1]) / 2;
  const yMid = (yExtent[0] + yExtent[1]) / 2;
  const hovered = rows.find((d) => d.code === hover);

  return (
    <div>
      <ViewHeader
        marker="01"
        title="The Driver Constellation"
        right={
          <div className="flex flex-wrap gap-1">
            {seasons.map((s) => (
              <button
                key={s}
                onClick={() => setSeason(s)}
                className={`mono rounded px-2.5 py-1.5 text-[12px] transition-colors ${
                  s === season
                    ? "bg-f1red text-white"
                    : "border border-hairline text-mute hover:border-hairline2 hover:text-paper"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        }
      >
        Each dot is a driver in the <span className="text-paper">{season}</span> season —
        horizontal is estimated <span className="text-paper">skill</span>, vertical is the{" "}
        <span className="text-paper">car</span> they drove. Hairlines link teammates, the
        comparison the model rides on. Dot size is laps in sample. Sit above the diagonal and
        the car is carrying you; below it, you are carrying the car.
      </ViewHeader>

      <div ref={ref} className="relative rounded-lg border border-hairline bg-panel">
        <svg width={w} height={HEIGHT} className="block gridbg rounded-lg">
          <g transform={`translate(${M.left},${M.top})`}>
            {/* quadrant dividers */}
            <line x1={x(xMid)} x2={x(xMid)} y1={0} y2={innerH} stroke="var(--color-hairline)" strokeDasharray="2 4" />
            <line x1={0} x2={innerW} y1={y(yMid)} y2={y(yMid)} stroke="var(--color-hairline)" strokeDasharray="2 4" />

            {/* result-expectation diagonal */}
            <line
              x1={x(xExtent[0] - padX)}
              y1={y(yExtent[0] - padY)}
              x2={x(xExtent[1] + padX)}
              y2={y(yExtent[1] + padY)}
              stroke="var(--color-f1red)"
              strokeOpacity={0.4}
              strokeWidth={1}
              strokeDasharray="1 5"
            />

            {/* quadrant labels */}
            <text x={innerW - 4} y={12} textAnchor="end" className="eyebrow" fill="var(--color-mute2)">Elite · top machinery</text>
            <text x={4} y={12} className="eyebrow" fill="var(--color-mute2)">Flattered by the car</text>
            <text x={innerW - 4} y={innerH - 6} textAnchor="end" className="eyebrow" fill="var(--color-mute2)">Punching above the car</text>
            <text x={4} y={innerH - 6} className="eyebrow" fill="var(--color-mute2)">Struggling</text>

            {/* axes */}
            {x.ticks(6).map((t) => (
              <g key={`x${t}`} transform={`translate(${x(t)},${innerH})`}>
                <line y2={5} stroke="var(--color-hairline2)" />
                <text y={19} textAnchor="middle" className="mono" fontSize={10} fill="var(--color-mute2)">{pct(t, 1)}</text>
              </g>
            ))}
            {y.ticks(6).map((t) => (
              <g key={`y${t}`} transform={`translate(0,${y(t)})`}>
                <line x2={-5} stroke="var(--color-hairline2)" />
                <text x={-9} dy={3} textAnchor="end" className="mono" fontSize={10} fill="var(--color-mute2)">{pct(t, 1)}</text>
              </g>
            ))}
            <text x={innerW / 2} y={innerH + 40} textAnchor="middle" className="eyebrow" fill="var(--color-mute)">Driver skill — % pace vs field avg →</text>
            <text transform={`translate(${-42},${innerH / 2}) rotate(-90)`} textAnchor="middle" className="eyebrow" fill="var(--color-mute)">Car performance →</text>

            {/* teammate hairlines */}
            {pairs.map(([a, b], i) => (
              <line
                key={i}
                x1={x(a.skill)} y1={y(a.car_perf)} x2={x(b.skill)} y2={y(b.car_perf)}
                stroke={a.color}
                strokeOpacity={hover ? (hover === a.code || hover === b.code ? 0.6 : 0.08) : 0.28}
                strokeWidth={1}
              />
            ))}

            {/* driver dots */}
            {rows.map((d) => {
              const active = !hover || hover === d.code;
              return (
                <g
                  key={d.code}
                  transform={`translate(${x(d.skill)},${y(d.car_perf)})`}
                  onMouseEnter={() => setHover(d.code)}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    r={r(d.laps)}
                    fill={d.color}
                    fillOpacity={active ? 0.9 : 0.2}
                    stroke={hover === d.code ? "#fff" : readable(d.color) === "#f2f3f5" ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.35)"}
                    strokeWidth={hover === d.code ? 1.5 : 0.75}
                  />
                  <text
                    x={r(d.laps) + 4}
                    dy={3}
                    className="mono"
                    fontSize={10}
                    fill={active ? "var(--color-paper)" : "var(--color-mute2)"}
                    style={{ pointerEvents: "none" }}
                  >
                    {d.code}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* hover card */}
        {hovered && (
          <div
            className="pointer-events-none absolute z-10 w-56 rounded-md border border-hairline2 bg-panel2/95 p-3 shadow-xl backdrop-blur"
            style={{
              left: Math.min(M.left + x(hovered.skill) + 18, w - 230),
              top: M.top + y(hovered.car_perf) - 10,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="h-3 w-1 rounded-sm" style={{ background: hovered.color }} />
              <span className="slant text-sm font-bold text-paper">{hovered.name}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-mute">{hovered.team} · {hovered.season}</p>
            <div className="mt-2 grid grid-cols-2 gap-y-1.5">
              <span className="eyebrow">Skill</span>
              <span className="mono text-right text-[12px] text-paper">{pct(hovered.skill)}%</span>
              <span className="eyebrow">Car</span>
              <span className="mono text-right text-[12px] text-paper">{pct(hovered.car_perf)}%</span>
              <span className="eyebrow">Laps</span>
              <span className="mono text-right text-[12px] text-paper">{hovered.laps}</span>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px] text-mute2">
        The dashed <span className="text-f1red">red</span> diagonal is where skill and car agree —
        distance from it is the story. Effects are in % of pole pace; higher is faster on both axes.
      </p>
    </div>
  );
}
