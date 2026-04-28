"use client";

import { memo, useEffect, useMemo } from "react";
import { formatMmSs } from "@/lib/formatTime";

type Props = {
  intervalsMs: number[];
  activeIndex?: number | null;
  remainingMs?: number;
  variant?: "standalone" | "embedded";
  flashActive?: boolean;
  prefersReducedMotion?: boolean;
};

function statusLabel(playing: boolean, i: number, activeIndex: number): "Done" | "Now" | "Next" | null {
  if (!playing) return null;
  if (i < activeIndex) return "Done";
  if (i === activeIndex) return "Now";
  if (i === activeIndex + 1) return "Next";
  return null;
}

type RingRowProps = {
  ringIndex: number;
  plannedMs: number;
  displayTime: string;
  slab: "Done" | "Now" | "Next" | null;
  isCurrent: boolean;
  isPast: boolean;
  rowFlash: boolean;
};

const RingRow = memo(function RingRow({
  ringIndex,
  plannedMs,
  displayTime,
  slab,
  isCurrent,
  isPast,
  rowFlash,
}: RingRowProps) {
  return (
    <div
      role="listitem"
      data-schedule-ring={ringIndex}
      aria-current={isCurrent ? "step" : undefined}
      className={[
        "relative px-2 py-3.5 transition-[background-color,opacity] duration-200 ease-ds-out sm:px-3 sm:py-4",
        "hover:bg-ds-section/40",
        isPast ? "opacity-70" : "",
        rowFlash ? "bg-ds-section/50" : isCurrent ? "bg-ds-section/25" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-[10px] font-normal uppercase tracking-[0.18em] text-ds-soft">
          {slab ? (
            <>
              {slab} <span className="text-ds-muted">·</span> Ring {ringIndex + 1}
            </>
          ) : (
            <>Ring {ringIndex + 1}</>
          )}
        </p>
        <p
          className={`font-mono tabular-nums tracking-tight transition-colors duration-200 ease-ds-out ${
            isCurrent
              ? "text-[clamp(1.5rem,min(7.5vmin,8vw),2.1rem)] leading-tight text-ds-bright"
              : "text-lg text-ds-fg sm:text-xl"
          }`}
        >
          {displayTime}
        </p>
        {isCurrent && plannedMs > 0 ? (
          <p className="text-[11px] text-ds-dim">Planned {formatMmSs(plannedMs)}</p>
        ) : null}
        {isPast ? <p className="text-[11px] text-ds-dim">Planned {formatMmSs(plannedMs)}</p> : null}
      </div>
    </div>
  );
});

export function IntervalSchedulePanel({
  intervalsMs,
  activeIndex = null,
  remainingMs = 0,
  variant = "standalone",
  flashActive = false,
  prefersReducedMotion = false,
}: Props) {
  const playing = typeof activeIndex === "number" && activeIndex >= 0;

  const total = intervalsMs.reduce((a, b) => a + b, 0);
  const n = intervalsMs.length;

  const elapsedPlannedMs = useMemo(() => {
    if (!playing || activeIndex == null || intervalsMs.length === 0) return 0;
    const idx = activeIndex;
    const before = intervalsMs.slice(0, idx).reduce((a, b) => a + b, 0);
    const planned = intervalsMs[idx] ?? 0;
    const remaining = Math.max(0, remainingMs);
    const consumed = Math.min(planned, Math.max(0, planned - remaining));
    return before + consumed;
  }, [playing, activeIndex, intervalsMs, remainingMs]);

  const progress =
    total > 0 ? Math.min(100, Math.max(0, (elapsedPlannedMs / total) * 100)) : 0;

  /** Instant scroll avoids fights with countdown updates and reads smoother than smooth scroll. */
  useEffect(() => {
    if (!playing) return;
    const id = window.requestAnimationFrame(() => {
      const el = document.querySelector(`[data-schedule-ring="${String(activeIndex)}"]`);
      el?.scrollIntoView({ block: "center", behavior: "auto" });
    });
    return () => cancelAnimationFrame(id);
  }, [playing, activeIndex]);

  const embedded = variant === "embedded";

  return (
    <div
      className={`mx-auto w-full max-w-3xl text-center ${
        embedded ? "border-0 bg-transparent px-0 py-0" : "border border-ds-section bg-ds-page px-4 py-5 sm:px-8"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:text-left">
        <h2 className="text-sm font-normal leading-snug text-ds-fg">
          {playing ? "Your run" : "Schedule"}
          <span className="text-ds-muted">
            {" "}
            · {n} ring{n === 1 ? "" : "s"}
          </span>
        </h2>

        {playing ? (
          <div className="flex w-full min-w-0 flex-col gap-2.5 sm:max-w-[min(100%,20rem)] sm:items-end">
            <p
              className="font-mono text-xs tabular-nums text-ds-muted sm:text-right"
              aria-label={`Elapsed ${formatMmSs(elapsedPlannedMs)} of ${formatMmSs(total)} total`}
            >
              {formatMmSs(elapsedPlannedMs)} <span className="text-ds-dim">/</span> {formatMmSs(total)}
            </p>
            <div
              className="h-0.5 w-full overflow-hidden rounded-full bg-ds-divider"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
              aria-valuetext={`${formatMmSs(elapsedPlannedMs)} elapsed of ${formatMmSs(total)}`}
            >
              <div className="h-full rounded-full bg-ds-bright/35" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <p className="font-mono text-xs tabular-nums text-ds-muted">{formatMmSs(total)} planned</p>
        )}
      </div>

      <div
        className={`mt-6 overflow-y-auto overscroll-y-contain [scrollbar-width:thin] ${
          embedded ? "max-h-[min(45vh,340px)] sm:max-h-[380px]" : "max-h-[min(62vh,560px)] sm:max-h-[620px]"
        }`}
        role="list"
        aria-label={playing ? "Ring timeline for this session" : "Generated ring durations"}
      >
        <div className="border-b border-ds-divider divide-y divide-ds-divider text-left">
          {intervalsMs.map((plannedMs, i) => {
            const isCurrent = playing && i === activeIndex;
            const isPast = playing && i < activeIndex;
            const slab =
              playing && activeIndex != null ? statusLabel(playing, i, activeIndex) : null;

            const durationShown =
              isCurrent && playing ? Math.max(0, remainingMs ?? 0) : Math.max(0, plannedMs);

            return (
              <RingRow
                key={`${i}-${plannedMs}`}
                ringIndex={i}
                plannedMs={plannedMs}
                displayTime={formatMmSs(durationShown)}
                slab={slab}
                isCurrent={isCurrent}
                isPast={isPast}
                rowFlash={Boolean(isCurrent && flashActive && !prefersReducedMotion)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
