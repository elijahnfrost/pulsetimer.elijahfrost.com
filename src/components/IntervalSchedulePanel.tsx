"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatMmSs } from "@/lib/formatTime";

type Props = {
  intervalsMs: number[];
  /** Optional label per ring (e.g. A–F); omit or shorter array to skip labels for some rings. */
  phaseLabels?: string[];
  activeIndex?: number | null;
  remainingMs?: number;
  variant?: "standalone" | "embedded";
  /** When embedded, let the scroll area grow to fill the column (parent should use flex/grid stretch). */
  fillHeight?: boolean;
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
  phaseLabel?: string;
  displayTime: string;
  slab: "Done" | "Now" | "Next" | null;
  isCurrent: boolean;
  isPast: boolean;
  rowFlash: boolean;
};

const RingRow = memo(function RingRow({
  ringIndex,
  phaseLabel,
  displayTime,
  slab,
  isCurrent,
  isPast,
  rowFlash,
}: RingRowProps) {
  const phaseSuffix =
    phaseLabel && phaseLabel.length > 0 ? (
      <>
        {" "}
        <span className="text-ds-muted">·</span> {phaseLabel}
      </>
    ) : null;

  return (
    <div
      role="listitem"
      data-schedule-ring={ringIndex}
      aria-current={isCurrent ? "step" : undefined}
      className={[
        "relative px-2 py-2.5 transition-[background-color,opacity] duration-200 ease-ds-out sm:px-2.5 sm:py-3",
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
              {phaseSuffix}
            </>
          ) : (
            <>
              Ring {ringIndex + 1}
              {phaseSuffix}
            </>
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
      </div>
    </div>
  );
});

function cumulativeHeightAbove(active: HTMLElement, maxSiblingsAbove: number): number {
  let h = 0;
  let n = 0;
  let sibling: Element | null = active.previousElementSibling;
  while (sibling instanceof HTMLElement && n < maxSiblingsAbove) {
    h += sibling.getBoundingClientRect().height;
    sibling = sibling.previousElementSibling;
    n += 1;
  }
  return h;
}

function computeTargetScrollTopForRing(
  scrollContainer: HTMLElement,
  activeEl: HTMLElement,
  siblingsVisibleAbove: number
): number {
  const abovePixels = cumulativeHeightAbove(activeEl, siblingsVisibleAbove);
  const scrollRect = scrollContainer.getBoundingClientRect();
  const activeRect = activeEl.getBoundingClientRect();
  const deltaInView = activeRect.top - scrollRect.top;
  const nextTopUnclamped =
    scrollContainer.scrollTop +
    deltaInView -
    abovePixels;
  const maxScroll = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
  return Math.max(0, Math.min(nextTopUnclamped, maxScroll));
}

/** Short ease-out nudge (~100ms) so ring changes feel responsive without sluggish scroll. */
const SCROLL_ANIM_MS = 105;

function runScrollAnimation(
  scrollEl: HTMLElement,
  targetTop: number,
  reducedMotion: boolean
): { cancel: () => void } {
  let rafId: number | null = null;
  let cancelled = false;

  if (reducedMotion) {
    scrollEl.scrollTop = targetTop;
    return { cancel: () => {} };
  }

  const from = scrollEl.scrollTop;
  const delta = targetTop - from;
  if (Math.abs(delta) < 0.75) {
    scrollEl.scrollTop = targetTop;
    return { cancel: () => {} };
  }

  const t0 = performance.now();

  const tick = (now: number) => {
    if (cancelled) return;
    const u = Math.min(1, (now - t0) / SCROLL_ANIM_MS);
    const eased = 1 - (1 - u) * (1 - u);
    scrollEl.scrollTop = from + delta * eased;
    if (u < 1) {
      rafId = window.requestAnimationFrame(tick);
    } else {
      rafId = null;
    }
  };

  rafId = window.requestAnimationFrame(tick);

  return {
    cancel: () => {
      cancelled = true;
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = null;
    },
  };
}

export function IntervalSchedulePanel({
  intervalsMs,
  phaseLabels,
  activeIndex = null,
  remainingMs = 0,
  variant = "standalone",
  fillHeight = false,
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

  const listScrollRef = useRef<HTMLDivElement>(null);
  const scrollAnimCancelRef = useRef<(() => void) | null>(null);
  const [fadeTop, setFadeTop] = useState(false);
  const [fadeBottom, setFadeBottom] = useState(false);

  const updateScrollFades = useCallback(() => {
    const el = listScrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const gap = 6;
    setFadeTop(scrollTop > gap);
    setFadeBottom(scrollTop + clientHeight < scrollHeight - gap);
  }, []);

  useLayoutEffect(() => {
    updateScrollFades();
  }, [updateScrollFades, intervalsMs]);

  useEffect(() => {
    const el = listScrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateScrollFades());
    ro.observe(el);
    window.addEventListener("resize", updateScrollFades);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateScrollFades);
    };
  }, [updateScrollFades]);

  /** Playback: one ring visible above current (like focusing ring 2); ring 1 stays at scroll 0 context. Fast ease-out scroll. */
  useEffect(() => {
    scrollAnimCancelRef.current?.();
    scrollAnimCancelRef.current = null;

    if (!playing || activeIndex == null) return;
    const scrollEl = listScrollRef.current;
    if (!scrollEl) return;

    const raw = typeof activeIndex === "number" ? activeIndex : 0;

    const rafOuter = window.requestAnimationFrame(() => {
      const active = scrollEl.querySelector<HTMLElement>(`[data-schedule-ring="${String(raw)}"]`);
      if (!active) return;

      /** One prior ring visible above — same framing as viewing “ring 2”; ring 0 has none above. */
      const siblingsAbove = raw === 0 ? 0 : 1;

      const targetTop = computeTargetScrollTopForRing(scrollEl, active, siblingsAbove);
      const { cancel } = runScrollAnimation(
        scrollEl,
        targetTop,
        prefersReducedMotion
      );
      scrollAnimCancelRef.current = cancel;
      window.requestAnimationFrame(() => updateScrollFades());
    });

    return () => {
      cancelAnimationFrame(rafOuter);
      scrollAnimCancelRef.current?.();
      scrollAnimCancelRef.current = null;
    };
  }, [
    playing,
    activeIndex,
    updateScrollFades,
    intervalsMs.length,
    prefersReducedMotion,
  ]);

  const embedded = variant === "embedded";
  const stretchList = embedded && fillHeight;

  return (
    <div
      className={[
        stretchList
          ? "flex h-full min-h-0 w-full min-w-0 flex-1 flex-col text-left"
          : "mx-auto w-full max-w-3xl text-center",
        embedded && !stretchList ? "border-0 bg-transparent px-0 py-0" : "",
        !embedded ? "px-4 py-5 sm:px-8" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[
          "flex min-w-0 flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-3 sm:text-left",
          stretchList ? "shrink-0 border-b border-ds-divider/50 pb-2 sm:pb-2.5" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <h2 className="text-sm font-normal leading-snug text-ds-fg">
          {playing ? "Your run" : "Schedule"}
          <span className="text-ds-muted">
            {n === 1 ? " · 1 ring" : ` · ${n} rings`}
          </span>
        </h2>

        {playing ? (
          <p
            className="w-full font-mono text-xs tabular-nums text-ds-muted sm:max-w-[min(100%,20rem)] sm:text-right"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            aria-valuetext={`${formatMmSs(elapsedPlannedMs)} elapsed of ${formatMmSs(total)}`}
          >
            {formatMmSs(elapsedPlannedMs)} <span className="text-ds-dim">/</span> {formatMmSs(total)}
          </p>
        ) : (
          <p className="font-mono text-xs tabular-nums text-ds-muted">{formatMmSs(total)}</p>
        )}
      </div>

      <div
        className={[
          "relative mt-3 sm:mt-4",
          stretchList ? "flex min-h-0 flex-1 flex-col" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          className={[
            "pointer-events-none absolute inset-x-0 top-0 z-[1] h-14 bg-gradient-to-b from-ds-page to-transparent transition-opacity duration-ds ease-ds-out",
            fadeTop ? "opacity-100" : "opacity-0",
          ].join(" ")}
          aria-hidden
        />
        <div
          ref={listScrollRef}
          onScroll={updateScrollFades}
          className={[
            "min-h-0 min-w-0 overflow-y-auto overscroll-y-contain [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]",
            stretchList
              ? "min-h-0 min-w-0 flex-1 basis-0"
              : embedded
                ? "max-h-[min(58vh,480px)] sm:max-h-[min(76vh,640px)]"
                : "max-h-[min(68vh,620px)] sm:max-h-[min(82vh,720px)]",
          ].join(" ")}
          role="list"
          aria-label={playing ? "Ring timeline for this session" : "Generated ring durations"}
        >
          <div className="relative divide-y divide-ds-divider text-left">
            {intervalsMs.map((plannedMs, i) => {
              const isCurrent = playing && i === activeIndex;
              const isPast = playing && i < activeIndex;
              const slab =
                playing && activeIndex != null ? statusLabel(playing, i, activeIndex) : null;

              const durationShown =
                isCurrent && playing ? Math.max(0, remainingMs ?? 0) : Math.max(0, plannedMs);

              const phaseLabel = phaseLabels?.[i];

              return (
                <RingRow
                  key={`${i}-${plannedMs}`}
                  ringIndex={i}
                  phaseLabel={phaseLabel}
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
        <div
          className={[
            "pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-24 bg-gradient-to-t from-ds-page to-transparent transition-opacity duration-ds ease-ds-out",
            fadeBottom ? "opacity-100" : "opacity-0",
          ].join(" ")}
          aria-hidden
        />
      </div>
    </div>
  );
}
