"use client";

import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { ShortcutHandles } from "@/types/hotkeys";
import { generateIntervals } from "@/lib/generateIntervals";
import { formatMmSs, formatRingRemainingLine } from "@/lib/formatTime";
import {
  MAX_DURATION_TOTAL_SEC,
  normalizeDurationParts,
  totalMsFromNormalizedParts,
} from "@/lib/normalizeDurationParts";
import { useAccurateTimer } from "@/hooks/useAccurateTimer";
import { primeAudioFromUserGesture, useAudioAlert } from "@/hooks/useAudioAlert";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { ControlButton, ControlsRow } from "./Controls";
import { NumberInput } from "./NumberInput";
import { IntervalSchedulePanel } from "./IntervalSchedulePanel";
import { IntervalSoundPanel } from "./IntervalSoundPanel";
import { VariabilitySlider } from "./VariabilitySlider";

const STORAGE_KEY = "pulse-timer:interval-v1";

type PersistShape = {
  minutes: number;
  secondsPart: number;
  rings: number;
  /** Short tones at each interval segment end (1–12). */
  chimeRepeats: number;
  /** 0–100; stored as percent for simple inputs. */
  chimeVolumePct: number;
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
  const [chimeRepeats, setChimeRepeats] = useState(5);
  const [chimeVolumePct, setChimeVolumePct] = useState(85);
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

  const remainingMsRef = useRef(remainingMs);
  remainingMsRef.current = remainingMs;
  const runningRef = useRef(running);
  runningRef.current = running;

  const chimeRepeatsRef = useRef(chimeRepeats);
  chimeRepeatsRef.current = chimeRepeats;
  const chimeVolumePctRef = useRef(chimeVolumePct);
  chimeVolumePctRef.current = chimeVolumePct;

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
        segmentDeadlineTs: runningRef.current ? ctr.getSegmentEndTs() : null,
        pausedRemainMs: runningRef.current ? null : remainingMsRef.current,
        actualMs: actualSegments.slice(),
      };
    }

    saveStored({
      minutes,
      secondsPart,
      rings,
      chimeRepeats,
      chimeVolumePct,
      variabilityPct,
      scheduleMs,
      phase,
      resume,
    });
  }, [
    minutes,
    secondsPart,
    rings,
    chimeRepeats,
    chimeVolumePct,
    variabilityPct,
    scheduleMs,
    phase,
    ctr,
    actualSegments,
  ]);

  const persistTickRef = useRef(persistTick);
  persistTickRef.current = persistTick;

  useEffect(() => {
    const s = loadStored();
    if (s) {
      const norm = normalizeDurationParts(s.minutes, s.secondsPart);
      setMinutes(norm.minutes);
      setSecondsPart(norm.secondsPart);
      setRings(s.rings);
      setChimeRepeats(
        typeof s.chimeRepeats === "number" && Number.isFinite(s.chimeRepeats)
          ? Math.max(1, Math.min(12, Math.round(s.chimeRepeats)))
          : 5
      );
      setChimeVolumePct(
        typeof s.chimeVolumePct === "number" && Number.isFinite(s.chimeVolumePct)
          ? Math.max(0, Math.min(100, Math.round(s.chimeVolumePct)))
          : 85
      );
      setVariabilityPct(s.variabilityPct);
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
    chimeRepeats,
    chimeVolumePct,
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

  const totalMsPlanned = totalMsFromNormalizedParts(minutes, secondsPart);

  const applySessionDuration = (nextMinutes: number, nextSecondsField: number) => {
    const n = normalizeDurationParts(nextMinutes, nextSecondsField);
    setMinutes(n.minutes);
    setSecondsPart(n.secondsPart);
  };

  const regenerate = () => {
    primeAudioFromUserGesture();
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
    primeAudioFromUserGesture();
    const v = variabilityPct / 100;
    const res = generateIntervals(totalMsPlanned, rings, v);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    intervalsRef.current = res.intervalsMs;
    setScheduleMs(res.intervalsMs);
    setPhase("play");
    indexRef.current = 0;
    setCurrentIndex(0);
    setActualSegments([]);
    const first = res.intervalsMs[0]!;
    ctr.reset(first);
    segmentsStartWallRef.current = Date.now();
    ctr.start();
    persistTick();
  };

  onSegmentCompleteRef.current = () => {
    playChime("interval", {
      intervalRepeats: chimeRepeatsRef.current,
      intervalVolume: chimeVolumePctRef.current / 100,
    });

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
        if (phase === "setup") beginPlayback();
      },
    };
    return () => {
      if (actionsRef) actionsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- align hotkey actions with interval state
  }, [actionsRef, phase, running]);

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
          className="mx-auto w-full max-w-6xl px-4 py-10 text-center sm:px-10"
        >
          <div
            className={
              scheduleMs?.length
                ? "lg:grid lg:grid-cols-3 lg:items-start lg:gap-x-10 lg:gap-y-0 lg:text-left"
                : ""
            }
          >
            <div className="mx-auto flex w-full flex-col gap-8 text-center lg:col-span-1 lg:mx-0 lg:max-w-none lg:text-left">
              <div className="mx-auto grid w-full min-w-0 max-w-[17.5rem] grid-cols-3 gap-4 sm:max-w-md sm:gap-5 lg:mx-0">
                <NumberInput
                  layout="fill"
                  label="Minutes"
                  value={minutes}
                  min={0}
                  max={999}
                  onChange={(v) => applySessionDuration(v, secondsPart)}
                />
                <NumberInput
                  layout="fill"
                  label="Seconds"
                  value={secondsPart}
                  min={0}
                  max={59}
                  strictClamp={false}
                  commitOnBlur
                  disableDec={minutes * 60 + secondsPart <= 0}
                  disableInc={minutes * 60 + secondsPart >= MAX_DURATION_TOTAL_SEC}
                  onChange={(raw) => applySessionDuration(minutes, raw)}
                />
                <NumberInput layout="fill" label="Rings" value={rings} min={1} max={500} onChange={setRings} />
              </div>
              <VariabilitySlider
                className="mx-auto w-full lg:mx-0 lg:max-w-none"
                value={variabilityPct}
                onChange={setVariabilityPct}
              />
              <IntervalSoundPanel
                className="lg:justify-start lg:pt-0"
                chimeRepeats={chimeRepeats}
                onChimeRepeatsChange={(v) => {
                  chimeRepeatsRef.current = v;
                  setChimeRepeats(v);
                }}
                chimeVolumePct={chimeVolumePct}
                onChimeVolumeChange={(v) => {
                  chimeVolumePctRef.current = v;
                  setChimeVolumePct(v);
                }}
              />
              <div className="mx-auto flex w-full max-w-md flex-col gap-3 lg:mx-0 lg:max-w-none">
                <ControlButton className="!min-w-0 w-full py-4" aria-label="Start interval session" onClick={beginPlayback}>
                  Start
                </ControlButton>
                <ControlButton
                  className="!min-w-0 w-full py-4"
                  aria-label="Generate schedule"
                  variant="secondary"
                  onClick={regenerate}
                >
                  {scheduleMs ? "Regenerate" : "Generate schedule"}
                </ControlButton>
              </div>
            </div>

            {scheduleMs && (
              <div className="mt-8 border-t border-ds-divider pt-6 lg:col-span-2 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                <IntervalSchedulePanel intervalsMs={scheduleMs} variant="embedded" />
              </div>
            )}
          </div>
        </section>
      )}

      {phase === "play" && sched.length > 0 && (
        <section
          aria-label="Playback"
          className="mx-auto mb-[max(0.5rem,env(safe-area-inset-bottom))] w-full max-w-6xl px-4 py-10 text-center sm:px-10"
        >
          <div className="lg:grid lg:grid-cols-3 lg:items-start lg:gap-x-10 lg:text-left">
            <div className="order-2 mt-8 flex min-w-0 flex-col gap-8 border-t border-ds-divider pt-8 lg:order-1 lg:col-span-1 lg:mt-0 lg:border-t-0 lg:pr-8 lg:pt-0">
              <div className="mx-auto flex w-full max-w-md flex-col gap-8 lg:mx-0">
                <IntervalSoundPanel
                  className="lg:justify-start lg:pt-0"
                  chimeRepeats={chimeRepeats}
                  onChimeRepeatsChange={(v) => {
                    chimeRepeatsRef.current = v;
                    setChimeRepeats(v);
                  }}
                  chimeVolumePct={chimeVolumePct}
                  onChimeVolumeChange={(v) => {
                    chimeVolumePctRef.current = v;
                    setChimeVolumePct(v);
                  }}
                />

                <div className="flex w-full flex-col gap-3">
                  <ControlButton
                    className="!min-w-0 w-full py-4"
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
                    className="!min-w-0 w-full py-4"
                    variant="secondary"
                    aria-label="Stop session"
                    onClick={() => {
                      primeAudioFromUserGesture();
                      stopSession();
                    }}
                  >
                    Stop
                  </ControlButton>
                </div>
              </div>
            </div>

            <div className="order-1 min-w-0 lg:order-2 lg:col-span-2 lg:border-l lg:border-ds-divider lg:pl-8">
              <IntervalSchedulePanel
                intervalsMs={sched}
                activeIndex={currentIndex}
                remainingMs={remainingMs}
                flashActive={flashRing}
                prefersReducedMotion={prefersReducedMotion}
                variant="embedded"
              />
            </div>
          </div>
        </section>
      )}

      {phase === "play" && sched.length === 0 && (
        <section
          aria-label="Recovery"
          className="mx-auto w-full max-w-3xl space-y-4 px-4 py-10 sm:px-10"
        >
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
          className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 text-center transition-opacity duration-ds ease-ds-out sm:px-10"
        >
          <p className="font-serif text-[1.65rem] font-light tracking-tight text-ds-fg">All rings complete.</p>
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
