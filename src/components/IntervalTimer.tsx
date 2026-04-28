"use client";

import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { ShortcutHandles } from "@/types/hotkeys";
import { generateIntervals } from "@/lib/generateIntervals";
import { formatMmSs, formatRingRemainingLine } from "@/lib/formatTime";
import { useAccurateTimer } from "@/hooks/useAccurateTimer";
import { useAudioAlert } from "@/hooks/useAudioAlert";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { CircularProgress } from "./CircularProgress";
import { ControlButton, ControlsRow } from "./Controls";
import { NumberInput } from "./NumberInput";
import { SchedulePreview } from "./SchedulePreview";
import { VariabilitySlider } from "./VariabilitySlider";

const STORAGE_KEY = "pulse-timer:interval-v1";

type PersistShape = {
  minutes: number;
  secondsPart: number;
  rings: number;
  variabilityPct: number;
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

    saveStored({
      minutes,
      secondsPart,
      rings,
      variabilityPct,
      scheduleMs,
      phase,
      resume:
        playing && intervals.length > 0
          ? {
              index: indexRef.current,
              segmentDeadlineTs: running ? ctr.getSegmentEndTs() : null,
              pausedRemainMs: running ? null : remainingMs,
              actualMs: actualSegments.slice(),
            }
          : null,
    });
  }, [
    minutes,
    secondsPart,
    rings,
    variabilityPct,
    scheduleMs,
    phase,
    running,
    remainingMs,
    ctr,
    actualSegments,
  ]);

  useEffect(() => {
    const s = loadStored();
    if (s) {
      setMinutes(s.minutes);
      setSecondsPart(s.secondsPart);
      setRings(s.rings);
      setVariabilityPct(s.variabilityPct);
      setScheduleMs(s.scheduleMs);
      setPhase(s.phase);
      intervalsRef.current = s.scheduleMs ?? [];
      indexRef.current = s.resume?.index ?? 0;
      setCurrentIndex(s.resume?.index ?? 0);
      setActualSegments(s.resume?.actualMs ?? []);

      const res = s.resume;
      requestAnimationFrame(() => {
        if (s.phase === "complete") return;
        if (s.phase === "play" && res && (s.scheduleMs?.length ?? 0) > 0) {
          const intervals = s.scheduleMs!;
          const idx = res.index ?? 0;
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
    const v = variabilityPct / 100;
    const res = generateIntervals(totalMsPlanned, rings, v);
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
    playChime();

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
      persistTick();
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
    <div className="space-y-8 mt-8 transition-opacity duration-150 ease-out">
      <p className="sr-only" aria-live="polite">
        {phase === "play"
          ? formatRingRemainingLine(
              currentIndex + 1,
              scheduleMs?.length ?? intervalsRef.current.length,
              totalRemainingAcross
            )
          : ""}
      </p>

      {phase !== "complete" && (
        <section
          aria-label="Interval setup"
          className="rounded-2xl border border-pulse-border bg-pulse-surface p-6 space-y-6"
        >
          <div className="flex flex-wrap justify-center gap-6">
            <NumberInput label="Minutes" value={minutes} min={0} max={999} onChange={setMinutes} disabled={phase === "play"} />
            <NumberInput
              label="Seconds"
              value={secondsPart}
              min={0}
              max={59}
              onChange={setSecondsPart}
              disabled={phase === "play"}
            />
            <NumberInput label="Rings" value={rings} min={1} max={500} onChange={setRings} disabled={phase === "play"} />
          </div>
          <VariabilitySlider value={variabilityPct} onChange={setVariabilityPct} disabled={phase === "play"} />
          <div className="flex gap-3 justify-center flex-wrap">
            <ControlButton
              aria-label="Generate schedule"
              variant="secondary"
              disabled={phase === "play"}
              onClick={regenerate}
            >
              {scheduleMs ? "Regenerate" : "Generate schedule"}
            </ControlButton>
            {scheduleMs && phase === "setup" && (
              <ControlButton aria-label="Start interval session" onClick={beginPlayback}>
                Start
              </ControlButton>
            )}
          </div>

          {scheduleMs && phase === "setup" && <SchedulePreview intervalsMs={scheduleMs} />}
        </section>
      )}

      {phase === "play" && (
        <section aria-label="Playback" className="flex flex-col items-center gap-6 text-center">
          <CircularProgress
            progress={progressed}
            flashing={flashRing}
            reducedMotion={prefersReducedMotion}
          >
            <div className="tabular-nums-light text-pulse-text">{ringDisplay}</div>
          </CircularProgress>

          <ControlsRow>
            <ControlButton
              aria-label={running ? "Pause" : "Resume"}
              onClick={() => {
                if (running) pausePlayback();
                else resumePlayback();
                persistTick();
              }}
            >
              {running ? "Pause" : "Resume"}
            </ControlButton>
            <ControlButton aria-label="Stop session" variant="secondary" onClick={stopSession}>
              Stop
            </ControlButton>
          </ControlsRow>
        </section>
      )}

      {phase === "complete" && (
        <section aria-live="polite" className="rounded-2xl border border-pulse-border bg-pulse-surface p-6 space-y-4 text-center transition-opacity duration-150 ease-out">
          <p className="text-2xl text-pulse-success font-medium">All rings complete.</p>
          <p className="text-[0.875rem] text-pulse-muted">Actual segment durations</p>
          <ul className="max-h-40 overflow-y-auto text-left text-sm space-y-1 text-pulse-text px-4">
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
