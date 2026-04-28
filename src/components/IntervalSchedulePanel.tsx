"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMmSs } from "@/lib/formatTime";

type SuccessionVariant = "past" | "current" | "upcoming";

function SuccessionCard({
  label,
  ringNum,
  durationMs,
  variant,
  subline,
}: {
  label: string;
  ringNum: number | null;
  durationMs: number | null;
  variant: SuccessionVariant;
  subline?: string;
}) {
  const shell =
    variant === "current"
      ? "z-[1] scale-[1.04] border-ds-bright/40 bg-ds-page shadow-[0_8px_30px_-12px_rgba(0,0,0,0.35)] ring-1 ring-ds-bright/20 dark:shadow-[0_8px_34px_-10px_rgba(0,0,0,0.55)]"
      : variant === "past"
        ? "scale-[0.94] border-ds-divider/90 bg-ds-page/55 opacity-[0.78]"
        : "scale-[0.94] border-ds-divider bg-ds-page/75 opacity-90";

  return (
    <div
      className={`rounded-2xl border px-3 py-3 text-center transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] sm:px-4 sm:py-3.5 ${shell}`}
    >
      <p className="text-[10px] font-normal uppercase tracking-[0.2em] text-ds-soft">{label}</p>
      {ringNum == null ? (
        <p className="mt-3 text-sm text-ds-muted">—</p>
      ) : (
        <>
          <p className="mt-2 text-xs text-ds-muted">Ring {ringNum}</p>
          <p
            className={`mt-1 font-mono text-lg tabular-nums tracking-tight sm:text-xl ${
              variant === "current" ? "text-ds-bright" : "text-ds-fg"
            }`}
          >
            {formatMmSs(Math.max(0, durationMs ?? 0))}
          </p>
          {subline ? <p className="mt-1 text-[11px] text-ds-dim">{subline}</p> : null}
        </>
      )}
    </div>
  );
}

function dockTransform(i: number, focusIndex: number | null): {
  scale: number;
  opacity: number;
  z: number;
  y: number;
  rotY: number;
} {
  if (focusIndex === null) {
    return { scale: 0.9, opacity: 0.78, z: 1, y: 0, rotY: 0 };
  }
  const d = Math.abs(i - focusIndex);
  const scale = d === 0 ? 1.12 : d === 1 ? 0.86 : Math.max(0.66, 1 - d * 0.12);
  const opacity = d === 0 ? 1 : d === 1 ? 0.72 : Math.max(0.38, 0.85 - d * 0.16);
  const z = 24 - d;
  const y = d === 0 ? -8 : 0;
  const rotY = Math.max(-14, Math.min(14, (i - focusIndex) * -9));
  return { scale, opacity, z, y, rotY };
}

type Props = {
  intervalsMs: number[];
  activeIndex?: number | null;
  remainingMs?: number;
  variant?: "standalone" | "embedded";
};

export function IntervalSchedulePanel({
  intervalsMs,
  activeIndex = null,
  remainingMs = 0,
  variant = "standalone",
}: Props) {
  const playing = typeof activeIndex === "number" && activeIndex >= 0;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const focusIndex = useMemo(() => {
    if (hoverIndex !== null) return hoverIndex;
    if (playing) return activeIndex;
    return null;
  }, [hoverIndex, playing, activeIndex]);

  const total = intervalsMs.reduce((a, b) => a + b, 0);
  const n = intervalsMs.length;
  const idx = playing ? activeIndex! : 0;
  const prevIdx = idx - 1;
  const nextIdx = idx + 1;
  const prevMs = prevIdx >= 0 ? intervalsMs[prevIdx]! : null;
  const nextMs = nextIdx < n ? intervalsMs[nextIdx]! : null;
  const plannedCurrent = intervalsMs[idx] ?? 0;

  useEffect(() => {
    if (hoverIndex !== null) return;
    if (!playing) return;
    const id = window.requestAnimationFrame(() => {
      const el = document.querySelector(`[data-schedule-ring="${String(activeIndex)}"]`);
      el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [playing, activeIndex, hoverIndex]);

  const embedded = variant === "embedded";

  return (
    <div
      className={`mx-auto w-full max-w-3xl text-center ${
        embedded ? "border-0 bg-transparent px-0 py-0" : "border border-ds-section bg-ds-page px-4 py-5 sm:px-8"
      }`}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:text-left">
        <h2 className="text-sm font-normal leading-snug text-ds-fg">
          {playing ? "Your run" : "Schedule"}
          <span className="text-ds-muted">
            {" "}
            · {n} ring{n === 1 ? "" : "s"}
          </span>
        </h2>
        <p className="font-mono text-xs tabular-nums text-ds-muted">{formatMmSs(total)} planned</p>
      </div>

      {playing ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-3 sm:gap-4 sm:items-stretch">
          <SuccessionCard label="Before" ringNum={prevIdx >= 0 ? prevIdx + 1 : null} durationMs={prevMs} variant="past" />
          <SuccessionCard
            label="Now"
            ringNum={idx + 1}
            durationMs={remainingMs}
            variant="current"
            subline={plannedCurrent > 0 ? `Planned ${formatMmSs(plannedCurrent)}` : undefined}
          />
          <SuccessionCard
            label="After"
            ringNum={nextIdx < n ? nextIdx + 1 : null}
            durationMs={nextMs}
            variant="upcoming"
          />
        </div>
      ) : null}

      <div className="mt-6">
        <p className="mb-1 text-[10px] uppercase tracking-[0.22em] text-ds-soft">
          {playing ? "Timeline" : "All rings"}
        </p>
        <p className="mb-4 text-[11px] text-ds-dim">Hover a ring to bring it forward</p>
        <div
          className="relative overflow-x-auto overflow-y-visible py-8 [scrollbar-width:thin]"
          style={{ perspective: "1100px" }}
          onPointerLeave={() => setHoverIndex(null)}
        >
          <div
            role="list"
            aria-label={playing ? "Ring order for this session" : "Generated ring durations"}
            className="mx-auto flex w-max max-w-full min-h-[5.5rem] items-end justify-center gap-1 px-3 sm:gap-2 sm:px-6"
            style={{ transformStyle: "preserve-3d" }}
          >
            {intervalsMs.map((ms, i) => {
              const { scale, opacity, z, y, rotY } = dockTransform(i, focusIndex);
              const isCurrent = playing && i === activeIndex;
              const isPast = playing && i < (activeIndex as number);

              return (
                <div
                  key={`${i}-${ms}`}
                  role="listitem"
                  data-schedule-ring={i}
                  aria-current={isCurrent ? "step" : undefined}
                  onPointerEnter={() => setHoverIndex(i)}
                  className={`relative flex min-w-[4.5rem] shrink-0 cursor-default select-none flex-col rounded-xl border px-2.5 py-2 text-left transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] sm:min-w-[5.5rem] sm:px-3 sm:py-2.5 ${
                    isCurrent && hoverIndex === null
                      ? "border-ds-bright/35 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]"
                      : "border-ds-divider"
                  } ${isPast ? "bg-ds-page/45" : "bg-ds-page/85"}`}
                  style={{
                    transform: `translateY(${y}px) rotateY(${rotY}deg) scale(${scale})`,
                    opacity,
                    zIndex: z,
                    transition: "transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms ease-out",
                  }}
                >
                  <span className="pointer-events-none text-[9px] font-normal uppercase tracking-[0.16em] text-ds-soft">
                    Ring {i + 1}
                  </span>
                  <span className="pointer-events-none mt-0.5 font-mono text-xs tabular-nums text-ds-fg sm:text-sm">
                    {formatMmSs(ms)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
