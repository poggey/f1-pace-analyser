"use client";

import { useEffect, useState } from "react";
import { loadApex, type Apex } from "@/lib/apex";
import Header from "@/components/Header";
import Constellation from "@/components/views/Constellation";
import Equalise from "@/components/views/Equalise";
import Heatmap from "@/components/views/Heatmap";
import CareerArc from "@/components/views/CareerArc";
import HeadToHead from "@/components/views/HeadToHead";
import Footer from "@/components/Footer";

type ViewId = "constellation" | "equalise" | "heatmap" | "career" | "h2h";

const VIEWS: { id: ViewId; label: string; marker: string; blurb: string }[] = [
  { id: "constellation", label: "Constellation", marker: "01", blurb: "Skill × car, the whole grid" },
  { id: "equalise", label: "Equalise", marker: "02", blurb: "One car, pure skill order" },
  { id: "heatmap", label: "Circuit Matrix", marker: "03", blurb: "Who comes alive where" },
  { id: "career", label: "Career Arc", marker: "04", blurb: "Skill, season by season" },
  { id: "h2h", label: "Head to Head", marker: "05", blurb: "Any two, equalised" },
];

function Loader() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-carbon">
      <div className="flex items-center gap-2.5">
        <span className="block h-8 w-[3px] animate-pulse bg-f1red" />
        <span className="slant text-3xl font-extrabold tracking-tight text-paper">APEX</span>
      </div>
      <p className="eyebrow live-dot">Establishing timing feed…</p>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<Apex | null>(null);
  const [view, setView] = useState<ViewId>("constellation");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadApex().then(setData).catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-carbon">
        <p className="mono text-sm text-f1red">FEED ERROR — {error}</p>
      </div>
    );
  }
  if (!data) return <Loader />;

  return (
    <div className="flex min-h-screen flex-col bg-carbon">
      <Header meta={data.meta} />

      {/* View switcher — broadcast segmented control */}
      <nav className="sticky top-0 z-20 border-b border-hairline bg-carbon/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-stretch gap-0 overflow-x-auto px-5 sm:px-8">
          {VIEWS.map((v) => {
            const active = v.id === view;
            return (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`group relative flex shrink-0 items-center gap-2.5 py-3 pr-6 pl-0 transition-colors sm:pr-8 ${
                  active ? "text-paper" : "text-mute hover:text-paper"
                }`}
              >
                <span
                  className={`mono text-[10px] leading-none ${
                    active ? "text-f1red" : "text-mute2 group-hover:text-mute"
                  }`}
                >
                  {v.marker}
                </span>
                <span className="flex flex-col items-start gap-0.5">
                  <span className="slant text-[15px] font-semibold leading-none tracking-tight">
                    {v.label}
                  </span>
                  <span className="hidden text-[10px] leading-none text-mute2 md:block">
                    {v.blurb}
                  </span>
                </span>
                {active && (
                  <span className="absolute inset-x-0 -bottom-px h-[2px] bg-f1red" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Stage */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div key={view} className="fade-in">
          {view === "constellation" && <Constellation data={data} />}
          {view === "equalise" && <Equalise data={data} />}
          {view === "heatmap" && <Heatmap data={data} />}
          {view === "career" && <CareerArc data={data} />}
          {view === "h2h" && <HeadToHead data={data} />}
        </div>
      </main>

      <Footer meta={data.meta} limitations={data.limitations} />
    </div>
  );
}
