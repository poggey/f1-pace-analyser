"use client";

import type { ReactNode } from "react";
import * as d3 from "d3";
import type { Apex } from "@/lib/apex";
import { pct, secs } from "@/lib/apex";
import { useMeasure } from "@/lib/useMeasure";

/* Compact, read-only renderings of each view for the multiview wall.
 * Every mini is a teaser, not a replacement: no controls, no hover cards —
 * clicking the tile drills into the full interactive view. */

export function Tile({
  marker,
  title,
  blurb,
  onOpen,
  children,
}: {
  marker: string;
  title: string;
  blurb: string;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onOpen}
      className="group flex w-full flex-col overflow-hidden rounded-lg border border-hairline bg-panel text-left transition-colors hover:border-hairline2"
    >
      <div className="flex items-baseline gap-2.5 border-b border-hairline px-4 py-2.5">
        <span className="mono text-[10px] leading-none text-f1red">{marker}</span>
        <span className="slant text-[14px] font-semibold leading-none tracking-tight text-paper">
          {title}
        </span>
        <span className="hidden text-[10px] leading-none text-mute2 sm:block">{blurb}</span>
        <span className="eyebrow ml-auto text-mute2 opacity-0 transition-opacity group-hover:opacity-100">
          Expand ▸
        </span>
      </div>
      <div className="pointer-events-none relative min-h-0 flex-1">{children}</div>
    </button>
  );
}

/* 01 — constellation: dots + hairlines, latest season */
export function MiniConstellation({ data, height }: { data: Apex; height: number }) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const w = Math.max(width, 200);
  const P = 14;

  const season = data.meta.seasons[data.meta.seasons.length - 1];
  const rows = data.driver_seasons.filter((d) => d.season === season);

  const xE = d3.extent(data.driver_seasons, (d) => d.skill) as [number, number];
  const yE = d3.extent(data.driver_seasons, (d) => d.car_perf) as [number, number];
  const x = d3.scaleLinear().domain(xE).range([P, w - P]);
  const y = d3.scaleLinear().domain(yE).range([height - P, P]);
  const r = d3.scaleSqrt().domain([0, d3.max(rows, (d) => d.laps) ?? 1]).range([2, 8]);

  const byCar = d3.group(rows, (d) => d.car_season);
  const pairs: [typeof rows[number], typeof rows[number]][] = [];
  for (const grp of byCar.values())
    for (let i = 0; i < grp.length; i++)
      for (let j = i + 1; j < grp.length; j++) pairs.push([grp[i], grp[j]]);

  return (
    <div ref={ref} className="h-full w-full">
      <svg width={w} height={height} className="block gridbg">
        <line
          x1={x(xE[0])} y1={y(yE[0])} x2={x(xE[1])} y2={y(yE[1])}
          stroke="var(--color-f1red)" strokeOpacity={0.35} strokeDasharray="1 5"
        />
        {pairs.map(([a, b], i) => (
          <line
            key={i}
            x1={x(a.skill)} y1={y(a.car_perf)} x2={x(b.skill)} y2={y(b.car_perf)}
            stroke={a.color} strokeOpacity={0.3} strokeWidth={1}
          />
        ))}
        {rows.map((d) => (
          <circle
            key={d.code}
            cx={x(d.skill)} cy={y(d.car_perf)} r={r(d.laps)}
            fill={d.color} fillOpacity={0.9}
            stroke="rgba(0,0,0,.35)" strokeWidth={0.75}
          />
        ))}
        <text x={w - P} y={P + 2} textAnchor="end" className="eyebrow" fill="var(--color-mute2)">
          {season} · skill → / car ↑
        </text>
      </svg>
    </div>
  );
}

/* 02 — equalise: top of the timing tower */
export function MiniTower({ data, height }: { data: Apex; height: number }) {
  const ROW = 30;
  const rows = data.equalise.order.slice(0, Math.max(3, Math.floor((height - 8) / ROW)));
  return (
    <div className="flex h-full flex-col justify-start px-3 py-1">
      {rows.map((o, i) => (
        <div
          key={o.code}
          className="flex items-center gap-2.5 border-b border-hairline/60 last:border-b-0"
          style={{ height: ROW }}
        >
          <span className="mono w-5 text-right text-[11px] text-mute">{i + 1}</span>
          <span className="h-3.5 w-[3px] rounded-sm" style={{ background: o.color }} />
          <span className="mono text-[12px] font-semibold text-paper">{o.code}</span>
          <span className="mono ml-auto text-[12px] text-mute">
            {i === 0 ? (
              <span className="text-green">LEADER</span>
            ) : (
              secs(o.gap_seconds)
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/* 03 — circuit matrix: the full texture, no labels */
export function MiniMatrix({ data, height }: { data: Apex; height: number }) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const w = Math.max(width, 200);
  const P = 10;

  const hm = data.heatmap;
  const rank = new Map(data.drivers.map((d, i) => [d.code, i]));
  const rows = hm.drivers
    .map((code, idx) => ({ code, idx }))
    .sort((a, b) => (rank.get(a.code) ?? 99) - (rank.get(b.code) ?? 99));

  const flat = hm.values.flat().filter((v): v is number => v != null);
  const absMax = d3.quantile(flat.map(Math.abs).sort(d3.ascending), 0.96) ?? 3;
  const color = (v: number) => {
    const t = Math.max(-1, Math.min(1, v / absMax));
    if (t < 0) return d3.interpolateRgb("#141519", "#27f4d2")(-t);
    return d3.interpolateRgb("#141519", "#e10600")(t);
  };

  const cw = (w - 2 * P) / hm.circuits.length;
  const ch = (height - 2 * P) / rows.length;

  return (
    <div ref={ref} className="h-full w-full">
      <svg width={w} height={height} className="block">
        {rows.map(({ idx: ri }, r) =>
          hm.circuits.map((_, ci) => {
            const v = hm.values[ri][ci];
            if (v == null) return null;
            return (
              <rect
                key={`${ri}-${ci}`}
                x={P + ci * cw} y={P + r * ch}
                width={Math.max(cw - 0.5, 0.5)} height={Math.max(ch - 0.5, 0.5)}
                fill={color(v)}
              />
            );
          }),
        )}
      </svg>
    </div>
  );
}

/* 04 — career arc: headline rivals, season by season */
const MINI_ARC_PICK = ["VER", "HAM", "LEC", "ALO"];

export function MiniArc({ data, height }: { data: Apex; height: number }) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const w = Math.max(width, 200);
  const P = { x: 14, top: 14, bottom: 18 };

  const seasons = data.meta.seasons;
  const byCode = new Map(data.drivers.map((d) => [d.code, d]));
  const series = MINI_ARC_PICK.filter((c) => data.career[c]).map((code) => ({
    code,
    color: byCode.get(code)?.color ?? "var(--color-mute)",
    points: [...data.career[code]].sort((a, b) => a.season - b.season),
  }));

  const pts = series.flatMap((s) => s.points);
  const lo = d3.min(pts, (p) => p.skill) ?? -1;
  const hi = d3.max(pts, (p) => p.skill) ?? 1;
  const pad = (hi - lo) * 0.15;

  const x = d3.scalePoint<number>().domain(seasons).range([P.x + 4, w - P.x - 22]);
  const y = d3.scaleLinear().domain([lo - pad, hi + pad]).range([height - P.bottom, P.top]);
  const line = d3
    .line<(typeof pts)[number]>()
    .x((p) => x(p.season) ?? 0)
    .y((p) => y(p.skill));

  return (
    <div ref={ref} className="h-full w-full">
      <svg width={w} height={height} className="block gridbg">
        {seasons.map((s) => (
          <text
            key={s}
            x={x(s)} y={height - 5}
            textAnchor="middle" className="mono" fontSize={8} fill="var(--color-mute2)"
          >
            {String(s).slice(2)}
          </text>
        ))}
        {series.map((s) => {
          const last = s.points[s.points.length - 1];
          return (
            <g key={s.code}>
              <path
                d={line(s.points) ?? undefined}
                fill="none" stroke={s.color} strokeOpacity={0.9} strokeWidth={1.5}
              />
              <text
                x={(x(last.season) ?? 0) + 5} y={y(last.skill)} dy={3}
                className="mono" fontSize={8} fill={s.color}
              >
                {s.code}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* 05 — head to head: the top two, equalised */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

export function MiniH2H({ data, height }: { data: Apex; height: number }) {
  const [a, b] = data.equalise.order;
  const cov = data.driver_covariance;
  const ia = cov.codes.indexOf(a.code);
  const ib = cov.codes.indexOf(b.code);
  const sd = Math.sqrt(
    Math.max(cov.matrix[ia][ia] + cov.matrix[ib][ib] - 2 * cov.matrix[ia][ib], 1e-9),
  );
  const conf = normalCdf((a.skill - b.skill) / sd);

  return (
    <div className="flex h-full flex-col justify-center gap-3 px-4" style={{ minHeight: height }}>
      <div className="flex items-center justify-between">
        {[a, b].map((o, i) => (
          <div key={o.code} className={i ? "text-right" : ""}>
            <div className={`flex items-center gap-1.5 ${i ? "flex-row-reverse" : ""}`}>
              <span className="h-3.5 w-[3px] rounded-sm" style={{ background: o.color }} />
              <span className="mono text-[13px] font-bold text-paper">{o.code}</span>
            </div>
            <p className="mono mt-1 text-[11px] text-mute">{pct(o.skill)}%</p>
          </div>
        ))}
      </div>
      <div className="text-center">
        <p className="mono slant text-2xl font-bold text-cyan">
          {secs(b.gap_seconds - a.gap_seconds)}s
        </p>
        <p className="eyebrow mt-1">per lap · same car</p>
      </div>
      <p className="text-center text-[10px] text-mute2">
        <span className="mono text-paper">{Math.round(conf * 100)}%</span> confidence{" "}
        {a.code} is faster — any pairing inside
      </p>
    </div>
  );
}
