"use client";

import { useMemo, useState } from "react";
import * as d3 from "d3";
import type { Apex, CareerPoint } from "@/lib/apex";
import { pct, readable } from "@/lib/apex";
import { useMeasure } from "@/lib/useMeasure";
import { ViewHeader } from "@/components/ui";

const HEIGHT = 560;
const M = { top: 24, right: 64, bottom: 44, left: 56 };
const DEFAULT_PICK = ["VER", "HAM", "LEC", "ALO"];

export default function CareerArc({ data }: { data: Apex }) {
  const [picked, setPicked] = useState<string[]>(
    DEFAULT_PICK.filter((c) => data.career[c]),
  );
  const [hover, setHover] = useState<string | null>(null);
  const { ref, width } = useMeasure<HTMLDivElement>();

  const byCode = useMemo(
    () => new Map(data.drivers.map((d) => [d.code, d])),
    [data],
  );

  const toggle = (code: string) =>
    setPicked((p) =>
      p.includes(code) ? p.filter((c) => c !== code) : [...p, code],
    );

  const series = useMemo(
    () =>
      picked
        .map((code) => ({
          code,
          driver: byCode.get(code),
          points: [...(data.career[code] ?? [])].sort((a, b) => a.season - b.season),
        }))
        .filter((s) => s.driver && s.points.length > 0),
    [picked, byCode, data],
  );

  const w = Math.max(width, 320);
  const innerW = w - M.left - M.right;
  const innerH = HEIGHT - M.top - M.bottom;

  const seasons = data.meta.seasons;
  const x = d3.scalePoint<number>().domain(seasons).range([0, innerW]);

  // Y covers the picked drivers' bands (or the whole grid when none picked).
  const yExtent = useMemo(() => {
    const pts = series.length
      ? series.flatMap((s) => s.points)
      : Object.values(data.career).flat();
    const lo = d3.min(pts, (p) => (p.ci ? p.ci[0] : p.skill)) ?? -1;
    const hi = d3.max(pts, (p) => (p.ci ? p.ci[1] : p.skill)) ?? 1;
    const pad = (hi - lo) * 0.08;
    return [lo - pad, hi + pad] as [number, number];
  }, [series, data]);

  const y = d3.scaleLinear().domain(yExtent).range([innerH, 0]);

  const line = d3
    .line<CareerPoint>()
    .x((p) => x(p.season) ?? 0)
    .y((p) => y(p.skill));
  const band = d3
    .area<CareerPoint>()
    .defined((p) => p.ci !== null)
    .x((p) => x(p.season) ?? 0)
    .y0((p) => y(p.ci ? p.ci[0] : p.skill))
    .y1((p) => y(p.ci ? p.ci[1] : p.skill));

  return (
    <div>
      <ViewHeader
        marker="04"
        title="The Career Arc"
        right={
          picked.length > 0 ? (
            <button
              onClick={() => setPicked([])}
              className="mono rounded border border-hairline px-2.5 py-1.5 text-[12px] text-mute transition-colors hover:border-hairline2 hover:text-paper"
            >
              Clear
            </button>
          ) : undefined
        }
      >
        One skill rating per driver is the headline; the arc relaxes it into a{" "}
        <span className="text-paper">season-by-season</span>{" "}
        estimate, shrunk toward the career line so thin seasons don&apos;t swing wildly. Bands are 95% bootstrap
        intervals — pick drivers below and watch form arrive, plateau, or fade.
      </ViewHeader>

      <div className="mb-3 flex flex-wrap gap-1">
        {data.drivers.map((d) => {
          const on = picked.includes(d.code);
          return (
            <button
              key={d.code}
              onClick={() => toggle(d.code)}
              className={`mono rounded px-2 py-1 text-[11px] transition-colors ${
                on ? "" : "border border-hairline text-mute hover:border-hairline2 hover:text-paper"
              }`}
              style={on ? { background: d.color, color: readable(d.color) } : undefined}
            >
              {d.code}
            </button>
          );
        })}
      </div>

      <div ref={ref} className="relative rounded-lg border border-hairline bg-panel">
        <svg width={w} height={HEIGHT} className="block gridbg rounded-lg">
          <g transform={`translate(${M.left},${M.top})`}>
            {/* field-average line */}
            <line
              x1={0}
              x2={innerW}
              y1={y(0)}
              y2={y(0)}
              stroke="var(--color-hairline2)"
              strokeDasharray="2 4"
            />
            <text x={innerW - 4} y={y(0) - 5} textAnchor="end" className="eyebrow" fill="var(--color-mute2)">
              Field average
            </text>

            {/* axes */}
            {seasons.map((s) => (
              <g key={s} transform={`translate(${x(s)},${innerH})`}>
                <line y2={5} stroke="var(--color-hairline2)" />
                <text y={19} textAnchor="middle" className="mono" fontSize={10} fill="var(--color-mute2)">
                  {s}
                </text>
              </g>
            ))}
            {y.ticks(6).map((t) => (
              <g key={t} transform={`translate(0,${y(t)})`}>
                <line x2={-5} stroke="var(--color-hairline2)" />
                <text x={-9} dy={3} textAnchor="end" className="mono" fontSize={10} fill="var(--color-mute2)">
                  {pct(t, 1)}
                </text>
              </g>
            ))}
            <text
              transform={`translate(${-42},${innerH / 2}) rotate(-90)`}
              textAnchor="middle"
              className="eyebrow"
              fill="var(--color-mute)"
            >
              Skill — % pace vs field avg →
            </text>

            {series.length === 0 && (
              <text x={innerW / 2} y={innerH / 2} textAnchor="middle" className="mono" fontSize={12} fill="var(--color-mute)">
                Select drivers above to draw their arcs
              </text>
            )}

            {/* CI bands, then lines on top */}
            {series.map((s) => {
              const active = !hover || hover === s.code;
              return (
                <path
                  key={`band-${s.code}`}
                  d={band(s.points) ?? undefined}
                  fill={s.driver!.color}
                  fillOpacity={active ? 0.13 : 0.04}
                />
              );
            })}
            {series.map((s) => {
              const active = !hover || hover === s.code;
              const last = s.points[s.points.length - 1];
              return (
                <g
                  key={s.code}
                  onMouseEnter={() => setHover(s.code)}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: "pointer" }}
                >
                  <path
                    d={line(s.points) ?? undefined}
                    fill="none"
                    stroke={s.driver!.color}
                    strokeOpacity={active ? 0.95 : 0.25}
                    strokeWidth={hover === s.code ? 2.25 : 1.5}
                  />
                  {s.points.map((p) => (
                    <circle
                      key={p.season}
                      cx={x(p.season)}
                      cy={y(p.skill)}
                      r={hover === s.code ? 3.5 : 2.5}
                      fill={s.driver!.color}
                      fillOpacity={active ? 1 : 0.3}
                    >
                      <title>
                        {s.driver!.name} · {p.season}: {pct(p.skill)}% ({p.laps} laps)
                      </title>
                    </circle>
                  ))}
                  <text
                    x={(x(last.season) ?? 0) + 8}
                    y={y(last.skill)}
                    dy={3}
                    className="mono"
                    fontSize={10}
                    fill={active ? s.driver!.color : "var(--color-mute2)"}
                  >
                    {s.code}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <p className="mt-3 text-[11px] text-mute2">
        Season points are the career rating plus a heavily shrunk per-season deviation —
        the anchor keeps rookies and one-off substitutes honest. Wider bands mean fewer
        laps; the <span className="text-paper">field average</span> sits at zero.
      </p>
    </div>
  );
}
