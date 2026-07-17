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
import { Tile, MiniConstellation, MiniTower, MiniMatrix, MiniArc, MiniH2H } from "@/components/minis";
import { useMeasure } from "@/lib/useMeasure";

type ViewId = "constellation" | "equalise" | "heatmap" | "career" | "h2h";
type Stage = "grid" | ViewId;

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
  const [stage, setStage] = useState<Stage>("grid");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadApex().then(setData).catch((e) => setError(String(e)));
  }, []);

  // Esc backs out of a focused view to the multiview wall.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStage("grid");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-carbon">
        <p className="mono text-sm text-f1red">FEED ERROR — {error}</p>
      </div>
    );
  }
  if (!data) return <Loader />;

  const focused = VIEWS.find((v) => v.id === stage);

  return (
    <div className="flex min-h-screen flex-col bg-carbon">
      <Header meta={data.meta} />

      {/* View switcher — broadcast segmented control */}
      <nav className="sticky top-0 z-20 border-b border-hairline bg-carbon/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-stretch gap-0 overflow-x-auto px-5 sm:px-8">
          <button
            onClick={() => setStage("grid")}
            className={`group relative flex shrink-0 items-center gap-2.5 py-3 pr-6 pl-0 transition-colors sm:pr-8 ${
              stage === "grid" ? "text-paper" : "text-mute hover:text-paper"
            }`}
          >
            <span
              className={`mono text-[10px] leading-none ${
                stage === "grid" ? "text-f1red" : "text-mute2 group-hover:text-mute"
              }`}
            >
              00
            </span>
            <span className="flex flex-col items-start gap-0.5">
              <span className="slant text-[15px] font-semibold leading-none tracking-tight">
                Multiview
              </span>
              <span className="hidden text-[10px] leading-none text-mute2 md:block">
                Every chart, one wall
              </span>
            </span>
            {stage === "grid" && (
              <span className="absolute inset-x-0 -bottom-px h-[2px] bg-f1red" />
            )}
          </button>
          {VIEWS.map((v) => {
            const active = v.id === stage;
            return (
              <button
                key={v.id}
                onClick={() => setStage(v.id)}
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
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-8 sm:py-6">
        {stage === "grid" ? (
          <div key="grid" className="fade-in">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:[height:calc(100vh-190px)] lg:min-h-[620px]">
              <div className="lg:col-span-2 lg:row-span-2 flex">
                <Tile
                  marker="01"
                  title="Constellation"
                  blurb="Skill × car, the whole grid"
                  onOpen={() => setStage("constellation")}
                >
                  <MiniGrow>{(h) => <MiniConstellation data={data} height={h} />}</MiniGrow>
                </Tile>
              </div>
              <div className="lg:row-span-2 flex">
                <Tile
                  marker="02"
                  title="Equalise"
                  blurb="One car, pure skill order"
                  onOpen={() => setStage("equalise")}
                >
                  <MiniGrow>{(h) => <MiniTower data={data} height={h} />}</MiniGrow>
                </Tile>
              </div>
              <div className="flex lg:h-[210px]">
                <Tile
                  marker="03"
                  title="Circuit Matrix"
                  blurb="Who comes alive where"
                  onOpen={() => setStage("heatmap")}
                >
                  <MiniGrow>{(h) => <MiniMatrix data={data} height={h} />}</MiniGrow>
                </Tile>
              </div>
              <div className="flex lg:h-[210px]">
                <Tile
                  marker="04"
                  title="Career Arc"
                  blurb="Skill, season by season"
                  onOpen={() => setStage("career")}
                >
                  <MiniGrow>{(h) => <MiniArc data={data} height={h} />}</MiniGrow>
                </Tile>
              </div>
              <div className="flex lg:h-[210px]">
                <Tile
                  marker="05"
                  title="Head to Head"
                  blurb="Any two, equalised"
                  onOpen={() => setStage("h2h")}
                >
                  <MiniGrow>{(h) => <MiniH2H data={data} height={h} />}</MiniGrow>
                </Tile>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-mute2">
              A director&apos;s wall of the whole model — click any panel (or its tab above) to
              drill into the full interactive view. <span className="mono">Esc</span> brings
              you back.
            </p>
          </div>
        ) : (
          <div key={stage} className="fade-in">
            <button
              onClick={() => setStage("grid")}
              className="mono mb-4 flex items-center gap-2 rounded border border-hairline px-2.5 py-1.5 text-[11px] text-mute transition-colors hover:border-hairline2 hover:text-paper"
            >
              ◂ Multiview
              <span className="text-mute2">esc</span>
            </button>
            {stage === "constellation" && <Constellation data={data} />}
            {stage === "equalise" && <Equalise data={data} />}
            {stage === "heatmap" && <Heatmap data={data} />}
            {stage === "career" && <CareerArc data={data} />}
            {stage === "h2h" && <HeadToHead data={data} />}
            <p className="sr-only">{focused?.blurb}</p>
          </div>
        )}
      </main>

      <Footer meta={data.meta} limitations={data.limitations} />
    </div>
  );
}

/* Measures the tile body so minis always fill whatever height the grid gives them. */
function MiniGrow({ children }: { children: (height: number) => React.ReactNode }) {
  const { ref, height } = useMeasure<HTMLDivElement>();
  return (
    <div ref={ref} className="h-full min-h-[140px] w-full">
      {height > 0 && children(Math.floor(height))}
    </div>
  );
}
