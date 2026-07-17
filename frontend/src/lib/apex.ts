// Types + loader for the APEX artifact (public/data/apex.json).
// Contract documented in analysis/SCHEMA.md. Sign convention: higher = faster.

export type CI = [number, number];

export interface Meta {
  codename: string;
  generated: string;
  seasons: number[];
  n_laps: number;
  n_drivers: number;
  n_car_seasons: number;
  n_circuits: number;
  method: string;
  lambda: { car: number; driver: number };
  r2: number;
  bootstrap_reps: number;
  connected: boolean;
  reference_circuit: string;
  reference_lap_seconds: number;
}

export interface Driver {
  code: string;
  name: string;
  team: string;
  lineage: string;
  color: string;
  laps: number;
  seasons: number[];
  skill: number;
  skill_ci: CI;
  effect: number;
}

export interface Car {
  car_season: string;
  team: string;
  lineage: string;
  season: number;
  color: string;
  laps: number;
  perf: number;
  perf_ci: CI;
}

export interface DriverSeason {
  code: string;
  name: string;
  season: number;
  team: string;
  lineage: string;
  color: string;
  laps: number;
  car_season: string;
  car_perf: number;
  car_perf_ci: CI;
  skill: number;
}

export interface Network {
  nodes: string[];
  edges: [string, string, number][];
  connected: boolean;
  n_components: number;
}

export interface ReferenceCar {
  car_season: string;
  team: string;
  season: number;
  lineage: string;
  color: string;
  lap_seconds: number;
}

export interface EqualiseOrder {
  code: string;
  name: string;
  lineage: string;
  color: string;
  skill: number;
  gap_seconds: number;
  gap_ci: CI;
}

export interface Equalise {
  reference_circuit: string;
  reference_lap_seconds: number;
  default_reference: string;
  reference_cars: ReferenceCar[];
  order: EqualiseOrder[];
}

export interface Heatmap {
  unit: string;
  circuits: string[];
  drivers: string[];
  values: (number | null)[][];
  counts: number[][];
  note: string;
}

export interface CareerPoint {
  season: number;
  skill: number;
  ci: CI | null;
  laps: number;
}

export interface DriverCovariance {
  codes: string[];
  matrix: number[][];
}

export interface ConstructorColor {
  label: string;
  color: string;
}

export interface Apex {
  meta: Meta;
  drivers: Driver[];
  driver_seasons: DriverSeason[];
  cars: Car[];
  network: Network;
  unrated: string[];
  equalise: Equalise;
  heatmap: Heatmap;
  career: Record<string, CareerPoint[]>;
  driver_covariance: DriverCovariance;
  constructor_colors: Record<string, ConstructorColor>;
  limitations: string[];
}

export async function loadApex(): Promise<Apex> {
  const res = await fetch("/data/apex.json", { cache: "force-cache" });
  if (!res.ok) throw new Error(`Failed to load apex.json (${res.status})`);
  return res.json();
}

// ---- shared helpers ----------------------------------------------------- //

/** Skill/perf effects are in % of pole pace; format with a sign. */
export function pct(v: number, digits = 2): string {
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}`;
}

/** Seconds gap, tower style (+0.123). */
export function secs(v: number, digits = 3): string {
  return `+${v.toFixed(digits)}`;
}

/** m:ss.mmm from seconds (broadcast lap time). */
export function lapTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

/** Contrast a hex colour to pick black/white text on top. */
export function readable(hex: string): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0a0a0b" : "#f2f3f5";
}
