"use client";

import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { ShortcutHandles } from "@/types/hotkeys";
import {
  DEFAULT_MIN_INTERVAL_MS,
  generateIntervals,
  WATER_CHANGE_MIN_INTERVAL_MS,
} from "@/lib/generateIntervals";
import { formatMmSs, formatRingRemainingLine } from "@/lib/formatTime";
import { useAccurateTimer } from "@/hooks/useAccurateTimer";
import { primeAudioFromUserGesture, useAudioAlert } from "@/hooks/useAudioAlert";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { CircularProgress } from "./CircularProgress";
import { ControlButton, ControlsRow } from "./Controls";
import { NumberInput } from "./NumberInput";
import { IntervalSchedulePanel } from "./IntervalSchedulePanel";
import { VariabilitySlider } from "./VariabilitySlider";

const STORAGE_KEY = "pulse-timer:interval-v1";

type PersistShape = {
  minutes: number;
  secondsPart: number;
  rings: number;
  variabilityPct: number;
  /** When true, each ring respects aquarium water-change pacing (longer minimum segment). */
  waterChangesPacing?: boolean;
  scheduleMs: number[] | null;
  phase: "setup" | "play" | "complete";
  resume:
    | null
    | {
        index: number;
        segmentDeadlineTs: number | null;
        pausedRemainMs: number | null;
        actualMs: number[];
      };
};

function loadStored(): PersistShape | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistShape) : null;
  } catch {
    return null;
  }
}

function saveStored(p: PersistShape) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    //
  }
}

type Props = {
  actionsRef?: MutableRefObject<ShortcutHandles | null>;
  onActivityChange?: (active: boolean) => void;
};

export function IntervalTimer({ actionsRef, onActivityChange }: Props) {
  const playChime = useAudioAlert();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [minutes, setMinutes] = useState(45);
  const [secondsPart, setSecondsPart] = useState(0);
  const [rings, setRings] = useState(12);
  const [variabilityPct, setVariabilityPct] = useState(40);
  const [waterChangesPacing, setWaterChangesPacing] = useState(false);

  const [scheduleMs, setScheduleMs] = useState<number[] | null>(null);
  const [phase, setPhase] = useState<"setup" | "play" | "complete">("setup");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [actualSegments, setActualSegments] = useState<number[]>([]);

  const [hydrated, setHydrated] = useState(false);
  const [flashRing, setFlashRing] = useState(false);

  const intervalsRef = useRef<number[]>([]);
  const indexRef = useRef(0);
  const segmentsStartWallRef = useRef<number | null>(null);

  const onSegmentCompleteRef = useRef<() => void>(() => {});

  const [remainingMs, running, ctr] = useAccurateTimer(() => onSegmentCompleteRef.current());

  const persistTick = useCallback(() => {
    const intervals =
      intervalsRef.current.length > 0 ? intervalsRef.current : scheduleMs ?? [];
    const playing = phase === "play";

    let resume: PersistShape["resume"] = null;
    if (phase === "complete" && intervals.length > 0) {
      resume = {
        index: 0,
        segmentDeadlineTs: null,
        pausedRemainMs: null,
        actualMs: actualSegments.slice(),
      };
    } else if (playing && intervals.length > 0) {
      resume = {
        index: indexRef.current,
        segmentDeadlineTs: running ? ctr.getSegmentEndTs() : null,
        pausedRemainMs: running ? null : remainingMs,
        actualMs: actualSegments.slice(),
      };
    }

    saveStored({
      minutes,
      secondsPart,
      rings,
      variabilityPct,
      waterChangesPacing,
      scheduleMs,
      phase,
      resume,
    });
  }, [
    minutes,
    secondsPart,
    rings,
    variabilityPct,
    waterChangesPacing,
    scheduleMs,
    phase,
    running,
    remainingMs,
    ctr,
    actualSegments,
  ]);

  const persistTickRef = useRef(persistTick);
  persistTickRef.current = persistTick;

  useEffect(() => {
    const s = loadStored();
    if (s) {
      setMinutes(s.minutes);
      setSecondsPart(s.secondsPart);
      setRings(s.rings);
      setVariabilityPct(s.variabilityPct);
      setWaterChangesPacing(Boolean(s.waterChangesPacing));
      const sched = Array.isArray(s.scheduleMs) ? s.scheduleMs : null;
      const hasSchedule = Boolean(sched?.length);
      let phase = s.phase;
      if ((phase === "play" || phase === "complete") && !hasSchedule) {
        phase = "setup";
      }
      setScheduleMs(hasSchedule ? sched : null);
      setPhase(phase);
      intervalsRef.current = hasSchedule ? sched! : [];
      if (phase === "play" && hasSchedule) {
        const maxIdx = Math.max(0, sched!.length - 1);
        const safeIdx = Math.min(s.resume?.index ?? 0, maxIdx);
        indexRef.current = safeIdx;
        setCurrentIndex(safeIdx);
        setActualSegments(s.resume?.actualMs ?? []);
      } else if (phase === "complete" && hasSchedule) {
        indexRef.current = 0;
        setCurrentIndex(0);
        setActualSegments(s.resume?.actualMs ?? []);
      } else {
        indexRef.current = 0;
        setCurrentIndex(0);
        setActualSegments([]);
      }

      const res = s.resume;
      requestAnimationFrame(() => {
        if (phase === "complete") return;
        if (phase === "play" && res && hasSchedule) {
          const intervals = sched!;
          const idx = Math.min(res.index ?? 0, Math.max(0, intervals.length - 1));
          intervalsRef.current = intervals;
          if (typeof res.pausedRemainMs === "number" && res.segmentDeadlineTs == null) {
            ctr.reset(res.pausedRemainMs);
          } else if (res.segmentDeadlineTs != null) {
            ctr.resumeWallClockUntil(res.segmentDeadlineTs);
          } else if (intervals[idx] != null) {
            ctr.reset(intervals[idx]!);
          }
          segmentsStartWallRef.current = Date.now();
        }
      });
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistTick();
  }, [
    hydrated,
    minutes,
    secondsPart,
    rings,
    variabilityPct,
    waterChangesPacing,
    scheduleMs,
    phase,
    persistTick,
  ]);

  useEffect(() => {
    if (!hydrated || phase !== "play") return;
    const id = window.setInterval(persistTick, 2600);
    return () => clearInterval(id);
  }, [hydrated, phase, persistTick]);

  useEffect(() => {
    const flush = () => persistTick();
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [persistTick]);

  const totalMsPlanned =
    minutes * 60_000 +
    Math.min(59, Math.max(0, Math.floor(secondsPart))) * 1000;

  const regenerate = () => {
    primeAudioFromUserGesture();
    const v = variabilityPct / 100;
    const minRingMs = waterChangesPacing ? WATER_CHANGE_MIN_INTERVAL_MS : DEFAULT_MIN_INTERVAL_MS;
    const res = generateIntervals(totalMsPlanned, rings, v, Math.random, minRingMs);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    intervalsRef.current = res.intervalsMs;
    setScheduleMs(res.intervalsMs);
    setPhase("setup");
    setCurrentIndex(0);
    indexRef.current = 0;
    setActualSegments([]);
    persistTick();
  };

  const beginPlayback = () => {
    primeAudioFromUserGesture();
    const intervals = intervalsRef.current.length ? intervalsRef.current : scheduleMs;
    if (!intervals?.length) return;
    intervalsRef.current = intervals;
    setPhase("play");
    indexRef.current = 0;
    setCurrentIndex(0);
    setActualSegments([]);
    const first = intervals[0];
    ctr.reset(first!);
    segmentsStartWallRef.current = Date.now();
    ctr.start();
    persistTick();
  };

  onSegmentCompleteRef.current = () => {
    playChime("interval");

    const intervals = intervalsRef.current;
    const idx = indexRef.current;
    const segDur = intervals[idx] ?? remainingMs;

    let startedAt = segmentsStartWallRef.current;
    if (startedAt == null) startedAt = Date.now() - segDur;
    const actual = Math.max(250, Math.round(Date.now() - startedAt));

    setActualSegments((prev) => [...prev, actual]);

    if (!prefersReducedMotion) {
      setFlashRing(true);
      window.setTimeout(() => setFlashRing(false), 300);
    } else {
      setFlashRing(false);
    }

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification("Pulse Timer", {
          body: `Ring ${idx + 1} of ${intervals.length}`,
        });
      } catch {
        //
      }
    }

    const next = idx + 1;
    indexRef.current = next;
    setCurrentIndex(next);

    if (next >= intervals.length) {
      setPhase("complete");
      ctr.pause();
      ctr.reset(0);
      segmentsStartWallRef.current = null;
      queueMicrotask(() => persistTickRef.current());
      return;
    }

    const nextDur = intervals[next];
    ctr.reset(nextDur!);
    segmentsStartWallRef.current = Date.now();
    ctr.start();
    persistTick();
  };

  const segmentDurationMs =
    intervalsRef.current[currentIndex] ?? scheduleMs?.[currentIndex] ?? remainingMs ?? 1;
  const safeSeg = Math.max(1, segmentDurationMs || 1);
  const progressed = 1 - Math.min(1, Math.max(0, remainingMs) / safeSeg);

  const sched = scheduleMs ?? intervalsRef.current;
  const totalRemainingAcross =
    sched.reduce((acc, ms, i) => {
      if (i > currentIndex) return acc + ms;
      if (i === currentIndex) return acc + remainingMs;
      return acc;
    }, 0) || 0;

  const pausePlayback = () => {
    ctr.pause();
    persistTick();
  };

  const resumePlayback = () => ctr.start();

  const stopSession = () => {
    ctr.pause();
    ctr.reset(0);
    setPhase("setup");
    indexRef.current = 0;
    setCurrentIndex(0);
    if (scheduleMs?.length) intervalsRef.current = scheduleMs.slice();
    segmentsStartWallRef.current = null;
    persistTick();
  };

  const ringDisplay = `${formatMmSs(Math.max(0, remainingMs))}`;

  useEffect(() => {
    onActivityChange?.(phase === "play" && running);
  }, [phase, running, onActivityChange]);

  useEffect(() => {
    if (!actionsRef) return;
    actionsRef.current = {
      toggle: () => {
        if (phase !== "play") return;
        primeAudioFromUserGesture();
        if (running) pausePlayback();
        else resumePlayback();
      },
      stop: () => {
        if (phase === "complete") setPhase("setup");
        else if (phase === "play") stopSession();
      },
      start: () => {
        if (phase === "setup" && scheduleMs) beginPlayback();
      },
    };
    return () => {
      if (actionsRef) actionsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- align hotkey actions with interval state
  }, [actionsRef, phase, running, scheduleMs]);

  return (
    <div className="mx-auto mt-8 w-full space-y-8 text-center transition-opacity duration-ds ease-ds-out">
      <p className="sr-only" aria-live="polite">
        {phase === "play"
          ? formatRingRemainingLine(
              currentIndex + 1,
              scheduleMs?.length ?? intervalsRef.current.length,
              totalRemainingAcross
            )
          : ""}
      </p>

      {phase !== "complete" && phase !== "play" && (
        <section
          aria-label="Interval setup"
          className="mx-auto w-full max-w-3xl space-y-6 border border-ds-section bg-ds-page px-4 py-8 text-center sm:px-10"
        >
          <div className="flex flex-wrap justify-center gap-6">
            <NumberInput label="Minutes" value={minutes} min={0} max={999} onChange={setMinutes} />
            <NumberInput
              label="Seconds"
              value={secondsPart}
              min={0}
              max={59}
              onChange={setSecondsPart}
            />
            <NumberInput label="Rings" value={rings} min={1} max={500} onChange={setRings} />
          </div>
          <VariabilitySlider value={variabilityPct} onChange={setVariabilityPct} />
          <label className="mx-auto flex max-w-md cursor-pointer select-none items-start gap-3 border border-ds-divider bg-ds-page/50 px-4 py-3 text-left sm:px-5">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 rounded border border-ds-divider accent-ds-bright"
              checked={waterChangesPacing}
              onChange={(e) => setWaterChangesPacing(e.target.checked)}
            />
            <span>
              <span className="block text-[10px] font-normal uppercase tracking-[0.2em] text-ds-soft">
                Water changes
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-ds-body">
                Require at least{" "}
                <span className="whitespace-nowrap font-mono text-ds-fg">
                  {WATER_CHANGE_MIN_INTERVAL_MS / 60_000} min
                </span>{" "}
                per ring so draining, filling, and conditioning stay realistic.
              </span>
            </span>
          </label>
          <div className="flex gap-3 justify-center flex-wrap">
            <ControlButton aria-label="Generate schedule" variant="secondary" onClick={regenerate}>
              {scheduleMs ? "Regenerate" : "Generate schedule"}
            </ControlButton>
            {scheduleMs && (
              <ControlButton aria-label="Start interval session" onClick={beginPlayback}>
                Start
              </ControlButton>
            )}
          </div>

          {scheduleMs && (
            <div className="mt-8 border-t border-ds-divider pt-8">
              <IntervalSchedulePanel intervalsMs={scheduleMs} variant="embedded" />
            </div>
          )}
        </section>
      )}

      {phase === "play" && sched.length > 0 && (
        <section aria-label="Playback" className="flex flex-col items-center gap-8 text-center">
          <CircularProgress progress={progressed} flashing={flashRing} reducedMotion={prefersReducedMotion}>
            {ringDisplay}
          </CircularProgress>

          <div className="w-full max-w-3xl px-1">
            <IntervalSchedulePanel
              intervalsMs={sched}
              activeIndex={currentIndex}
              remainingMs={remainingMs}
            />
          </div>

          <ControlsRow>
            <ControlButton
              aria-label={running ? "Pause" : "Resume"}
              onClick={() => {
                primeAudioFromUserGesture();
                if (running) pausePlayback();
                else resumePlayback();
                persistTick();
              }}
            >
              {running ? "Pause" : "Resume"}
            </ControlButton>
            <ControlButton
              aria-label="Stop session"
              variant="secondary"
              onClick={() => {
                primeAudioFromUserGesture();
                stopSession();
              }}
            >
              Stop
            </ControlButton>
          </ControlsRow>
        </section>
      )}

      {phase === "play" && sched.length === 0 && (
        <section
          aria-label="Recovery"
          className="mx-auto w-full max-w-3xl space-y-4 border border-ds-section bg-ds-page px-4 py-8 sm:px-10"
        >
          <p className="text-sm text-ds-body">
            This session had no saved rings. Go back to setup to generate a schedule.
          </p>
          <ControlsRow>
            <ControlButton
              aria-label="Back to interval setup"
              onClick={() => {
                ctr.pause();
                ctr.reset(0);
                setPhase("setup");
                indexRef.current = 0;
                setCurrentIndex(0);
                segmentsStartWallRef.current = null;
                persistTick();
              }}
            >
              Back to setup
            </ControlButton>
          </ControlsRow>
        </section>
      )}

      {phase === "complete" && (
        <section
          aria-live="polite"
          className="mx-auto w-full max-w-3xl space-y-6 border border-ds-section bg-ds-page px-4 py-8 text-center transition-opacity duration-ds ease-ds-out sm:px-10"
        >
          <p className="font-serif text-[1.65rem] font-light tracking-tight text-ds-fg">All rings complete.</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-ds-soft">Actual segment durations</p>
          <ul className="mx-auto max-h-40 max-w-lg space-y-1 overflow-y-auto px-2 text-center text-sm leading-relaxed text-ds-body">
            {actualSegments.map((ms, i) => (
              <li key={`${i}-${ms}`}>
                Ring {i + 1}: {formatMmSs(ms)}
              </li>
            ))}
          </ul>
          <ControlsRow>
            <ControlButton variant="secondary" onClick={() => setPhase("setup")} aria-label="Back to setup">
              Setup
            </ControlButton>
          </ControlsRow>
        </section>
      )}
    </div>
  );
}
