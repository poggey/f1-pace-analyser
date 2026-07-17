import type { Meta } from "@/lib/apex";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-3.5 border-l border-hairline first:border-l-0 first:pl-0">
      <span className="eyebrow leading-none">{label}</span>
      <span className="mono text-[13px] text-paper leading-none">{value}</span>
    </div>
  );
}

export default function Header({ meta }: { meta: Meta }) {
  const seasons = `${meta.seasons[0]}–${meta.seasons[meta.seasons.length - 1]}`;
  return (
    <header className="border-b border-hairline bg-panel/60 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-y-4 px-5 py-3.5 sm:px-8">
        {/* Wordmark */}
        <div className="flex items-end gap-3">
          <div className="flex items-center gap-2.5">
            <span className="block h-7 w-[3px] bg-f1red" />
            <h1 className="slant text-2xl font-extrabold tracking-tight text-paper">
              APEX
            </h1>
          </div>
          <p className="mb-0.5 hidden text-[11px] leading-tight text-mute sm:block max-w-[15rem]">
            Driver skill vs car performance,
            <br className="hidden md:block" /> pulled apart from the lap times.
          </p>
        </div>

        {/* Broadcast meta strip */}
        <div className="flex items-center">
          <div className="flex items-center gap-2 pr-4">
            <span className="live-dot block h-1.5 w-1.5 rounded-full bg-green" />
            <span className="eyebrow text-green">Model Live</span>
          </div>
          <Stat label="Seasons" value={seasons} />
          <Stat label="Laps" value={meta.n_laps.toLocaleString()} />
          <Stat label="Drivers" value={String(meta.n_drivers)} />
          <Stat label="Cars" value={String(meta.n_car_seasons)} />
          <Stat label="R²" value={meta.r2.toFixed(2)} />
        </div>
      </div>
    </header>
  );
}
