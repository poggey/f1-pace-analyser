import type { ReactNode } from "react";

/** Section header: mono eyebrow marker + slanted display title + blurb. */
export function ViewHeader({
  marker,
  title,
  children,
  right,
}: {
  marker: string;
  title: string;
  children?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="mono text-[11px] text-f1red">/{marker}</span>
          <span className="h-px w-8 bg-hairline2" />
        </div>
        <h2 className="slant text-3xl font-extrabold tracking-tight text-paper sm:text-[34px]">
          {title}
        </h2>
        {children && (
          <p className="mt-2 text-[13px] leading-relaxed text-mute">{children}</p>
        )}
      </div>
      {right}
    </div>
  );
}

/** Raised carbon panel. */
export function Panel({
  children,
  className = "",
  pad = true,
}: {
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-hairline bg-panel ${pad ? "p-4 sm:p-5" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/** Small constructor swatch. */
export function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
      style={{ background: color }}
    />
  );
}
