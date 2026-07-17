"use client";

import { useState } from "react";
import type { Meta } from "@/lib/apex";

export default function Footer({
  meta,
  limitations,
}: {
  meta: Meta;
  limitations: string[];
}) {
  const [open, setOpen] = useState(false);
  const generated = new Date(meta.generated).toISOString().slice(0, 10);

  return (
    <footer className="mt-4 border-t border-hairline bg-panel/40">
      <div className="mx-auto max-w-[1600px] px-5 py-5 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-3xl text-[11px] leading-relaxed text-mute2">
            <span className="text-mute">Method — </span>
            two-way effects model (ridge-penalised least squares); driver and
            car-season effects shrunk, circuit a fixed baseline. Identified by the
            teammate/transfer network; confidence from a session-level bootstrap
            ({meta.bootstrap_reps} reps). The equalised order is a counterfactual —
            the model&rsquo;s best estimate, not a measured result.
          </p>
          <button
            onClick={() => setOpen((v) => !v)}
            className="eyebrow shrink-0 rounded border border-hairline px-3 py-1.5 text-mute transition-colors hover:border-hairline2 hover:text-paper"
          >
            {open ? "Hide" : "Where the model can be wrong"}
          </button>
        </div>

        {open && (
          <ul className="fade-in mt-4 grid gap-2 border-t border-hairline pt-4 sm:grid-cols-2 lg:grid-cols-3">
            {limitations.map((l, i) => (
              <li key={i} className="flex gap-2 text-[11px] leading-relaxed text-mute">
                <span className="mono text-f1red">{String(i + 1).padStart(2, "0")}</span>
                <span>{l}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3">
          <span className="eyebrow text-mute2">
            APEX · Pace Decomposition Engine
          </span>
          <span className="mono text-[10px] text-mute2">
            FastF1 · fitted {generated}
          </span>
        </div>
      </div>
    </footer>
  );
}
