"use client";

import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShortcutHandles } from "@/types/hotkeys";
import {
  MAX_PATTERN_PHASES,
  buildPatternScheduleFitTotal,
  buildPatternScheduleFixed,
  buildRandomSchedule,
  mixSeed,
  mulberry32,
  phaseLabelsForSchedule,
} from "@/lib/buildIntervalSchedule";
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
import {
  PatternScheduleEditor,
  type PatternConstraint,
  type PatternPhasePersist,
} from "./PatternScheduleEditor";
import { SegmentedControl } from "./SegmentedControl";
import { SetupSectionTitle } from "./SetupSectionTitle";
import { VariabilitySlider } from "./VariabilitySlider";

const STORAGE_KEY_V2 = "pulse-timer:interval-v2";
const STORAGE_KEY_V1 = "pulse-timer:interval-v1";

type ScheduleMode = "pattern" | "random";

type PersistShapeV1 = {
  minutes: number;
  secondsPart: number;
  rings: number;
  chimeRepeats: number;
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

type PersistShape = {
  version: 2;
  scheduleMode: ScheduleMode;
  patternConstraint: PatternConstraint;
  patternSlots: PatternPhasePersist[];
  shuffleNonce: number;
  minutes: number;
  secondsPart: number;
  rings: number;
  chimeRepeats: number;
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

function defaultPatternSlots(): PatternPhasePersist[] {
  return [
    { minutes: 5, secondsPart: 0 },
    { minutes: 2, secondsPart: 0 },
  ];
}

function normalizePatternSlots(raw: unknown): PatternPhasePersist[] {
  if (!Array.isArray(raw) || raw.length === 0) return defaultPatternSlots();
  const out: PatternPhasePersist[] = [];
  for (let i = 0; i < Math.min(MAX_PATTERN_PHASES, raw.length); i++) {
    const item = raw[i] as { minutes?: number; secondsPart?: number };
    const norm = normalizeDurationParts(item?.minutes ?? 0, item?.secondsPart ?? 0);
    out.push({ minutes: norm.minutes, secondsPart: norm.secondsPart });
  }
  return out.length > 0 ? out : defaultPatternSlots();
}

function migrateV1(s: PersistShapeV1): PersistShape {
  return {
    version: 2,
    scheduleMode: "random",
    patternConstraint: "fitTotal",
    patternSlots: defaultPatternSlots(),
    shuffleNonce: 0,
    minutes: s.minutes,
    secondsPart: s.secondsPart,
    rings: s.rings,
    chimeRepeats:
      typeof s.chimeRepeats === "number" && Number.isFinite(s.chimeRepeats)
        ? Math.max(1, Math.min(12, Math.round(s.chimeRepeats)))
        : 5,
    chimeVolumePct:
      typeof s.chimeVolumePct === "number" && Number.isFinite(s.chimeVolumePct)
        ? Math.max(0, Math.min(100, Math.round(s.chimeVolumePct)))
        : 85,
    variabilityPct: s.variabilityPct,
    scheduleMs: Array.isArray(s.scheduleMs) ? s.scheduleMs : null,
    phase: s.phase,
    resume: s.resume ?? null,
  };
}

function parseStored(json: unknown): PersistShape | null {
  if (typeof json !== "object" || json === null) return null;
  const o = json as Record<string, unknown>;
  if (o.version === 2) {
    const scheduleMode: ScheduleMode = o.scheduleMode === "pattern" ? "pattern" : "random";
    const patternConstraint: PatternConstraint =
      o.patternConstraint === "fixed" ? "fixed" : "fitTotal";
    const shuffleNonce =
      typeof o.shuffleNonce === "number" && Number.isFinite(o.shuffleNonce)
        ? Math.max(0, Math.floor(o.shuffleNonce))
        : 0;
    return {
      version: 2,
      scheduleMode,
      patternConstraint,
      patternSlots: normalizePatternSlots(o.patternSlots),
      shuffleNonce,
      minutes: typeof o.minutes === "number" ? o.minutes : 45,
      secondsPart: typeof o.secondsPart === "number" ? o.secondsPart : 0,
      rings: typeof o.rings === "number" ? o.rings : 12,
      chimeRepeats:
        typeof o.chimeRepeats === "number" && Number.isFinite(o.chimeRepeats)
          ? Math.max(1, Math.min(12, Math.round(o.chimeRepeats)))
          : 5,
      chimeVolumePct:
        typeof o.chimeVolumePct === "number" && Number.isFinite(o.chimeVolumePct)
          ? Math.max(0, Math.min(100, Math.round(o.chimeVolumePct)))
          : 85,
      variabilityPct: typeof o.variabilityPct === "number" ? o.variabilityPct : 40,
      scheduleMs: Array.isArray(o.scheduleMs) ? (o.scheduleMs as number[]) : null,
      phase:
        o.phase === "play" || o.phase === "complete" || o.phase === "setup" ? o.phase : "setup",
      resume: (o.resume as PersistShape["resume"]) ?? null,
    };
  }
  return migrateV1(json as PersistShapeV1);
}

function loadStored(): PersistShape | null {
  if (typeof window === "undefined") return null;
  try {
    const raw2 = window.localStorage.getItem(STORAGE_KEY_V2);
    if (raw2) {
      const p = parseStored(JSON.parse(raw2));
      if (p) return p;
    }
    const raw1 = window.localStorage.getItem(STORAGE_KEY_V1);
    if (raw1) {
      return parseStored(JSON.parse(raw1));
    }
  } catch {
    //
  }
  return null;
}

function saveStored(p: PersistShape) {
  try {
    window.localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(p));
  } catch {
    //
  }
}

type SchedulePreview =
  | { ok: true; intervalsMs: number[]; phaseLabels: string[] }
  | { ok: false; error: string };

type Props = {
  actionsRef?: MutableRefObject<ShortcutHandles | null>;
  onActivityChange?: (active: boolean) => void;
};

export function IntervalTimer({ actionsRef, onActivityChange }: Props) {
  const playChime = useAudioAlert();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("pattern");
  const [patternConstraint, setPatternConstraint] = useState<PatternConstraint>("fitTotal");
  const [patternSlots, setPatternSlots] = useState<PatternPhasePersist[]>(defaultPatternSlots);
  const [shuffleNonce, setShuffleNonce] = useState(0);

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

  const totalMsPlanned = totalMsFromNormalizedParts(minutes, secondsPart);
  const ringCount = Math.max(1, Math.min(500, Math.floor(rings)));

  const schedulePreview = useMemo((): SchedulePreview => {
    const n = ringCount;
    if (scheduleMode === "random") {
      const v = variabilityPct / 100;
      const seed = mixSeed([totalMsPlanned, n, variabilityPct, shuffleNonce]);
      const rng = mulberry32(seed);
      const res = buildRandomSchedule(totalMsPlanned, n, v, rng);
      if (!res.ok) {
        return { ok: false, error: res.error };
      }
      const blanks = Array.from({ length: n }, () => "");
      return { ok: true, intervalsMs: res.intervalsMs, phaseLabels: blanks };
    }

    const k = patternSlots.length;
    const weightsMs = patternSlots.map((s) => totalMsFromNormalizedParts(s.minutes, s.secondsPart));

    if (patternConstraint === "fitTotal") {
      const res = buildPatternScheduleFitTotal(totalMsPlanned, n, weightsMs);
      if (!res.ok) {
        return { ok: false, error: res.error };
      }
      return {
        ok: true,
        intervalsMs: res.intervalsMs,
        phaseLabels: phaseLabelsForSchedule(n, k),
      };
    }

    const res = buildPatternScheduleFixed(n, weightsMs);
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    return {
      ok: true,
      intervalsMs: res.intervalsMs,
      phaseLabels: phaseLabelsForSchedule(n, k),
    };
  }, [scheduleMode, patternConstraint, patternSlots, ringCount, totalMsPlanned, variabilityPct, shuffleNonce]);

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
      version: 2,
      scheduleMode,
      patternConstraint,
      patternSlots,
      shuffleNonce,
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
    scheduleMode,
    patternConstraint,
    patternSlots,
    shuffleNonce,
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
      setScheduleMode(s.scheduleMode);
      setPatternConstraint(s.patternConstraint);
      setPatternSlots(normalizePatternSlots(s.patternSlots));
      setShuffleNonce(s.shuffleNonce);
      setChimeRepeats(s.chimeRepeats);
      setChimeVolumePct(s.chimeVolumePct);
      setVariabilityPct(s.variabilityPct);
      const sched = Array.isArray(s.scheduleMs) ? s.scheduleMs : null;
      const hasSchedule = Boolean(sched?.length);
      let phaseLoaded = s.phase;
      if ((phaseLoaded === "play" || phaseLoaded === "complete") && !hasSchedule) {
        phaseLoaded = "setup";
      }
      setScheduleMs(hasSchedule ? sched : null);
      setPhase(phaseLoaded);
      intervalsRef.current = hasSchedule ? sched! : [];
      if (phaseLoaded === "play" && hasSchedule) {
        const maxIdx = Math.max(0, sched!.length - 1);
        const safeIdx = Math.min(s.resume?.index ?? 0, maxIdx);
        indexRef.current = safeIdx;
        setCurrentIndex(safeIdx);
        setActualSegments(s.resume?.actualMs ?? []);
      } else if (phaseLoaded === "complete" && hasSchedule) {
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
        if (phaseLoaded === "complete") return;
        if (phaseLoaded === "play" && res && hasSchedule) {
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
    if (!hydrated || phase !== "setup") return;
    if (schedulePreview.ok) {
      setScheduleMs(schedulePreview.intervalsMs);
    } else {
      setScheduleMs(null);
    }
  }, [hydrated, phase, schedulePreview]);

  useEffect(() => {
    if (!hydrated) return;
    persistTick();
  }, [
    hydrated,
    scheduleMode,
    patternConstraint,
    patternSlots,
    shuffleNonce,
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

  const applySessionDuration = (nextMinutes: number, nextSecondsField: number) => {
    const n = normalizeDurationParts(nextMinutes, nextSecondsField);
    setMinutes(n.minutes);
    setSecondsPart(n.secondsPart);
  };

  const beginPlayback = useCallback(() => {
    primeAudioFromUserGesture();
    if (!schedulePreview.ok || !schedulePreview.intervalsMs.length) {
      alert(schedulePreview.ok ? "Fix the schedule before starting." : schedulePreview.error);
      return;
    }
    const intervals = schedulePreview.intervalsMs;
    intervalsRef.current = intervals;
    setScheduleMs(intervals);
    setPhase("play");
    indexRef.current = 0;
    setCurrentIndex(0);
    setActualSegments([]);
    const first = intervals[0]!;
    ctr.reset(first);
    segmentsStartWallRef.current = Date.now();
    ctr.start();
    persistTick();
  }, [schedulePreview, ctr, persistTick]);

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

  const playbackPhaseLabels =
    scheduleMode === "pattern" && sched.length > 0
      ? phaseLabelsForSchedule(sched.length, patternSlots.length)
      : undefined;

  const setupIntervals =
    phase === "setup" && schedulePreview.ok ? schedulePreview.intervalsMs : scheduleMs ?? [];
  const setupPhaseLabels =
    phase === "setup" && schedulePreview.ok ? schedulePreview.phaseLabels : undefined;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hotkeys must match latest beginPlayback without re-registering every pause tick
  }, [actionsRef, phase, running, beginPlayback]);

  const setupScheduleError = phase === "setup" && !schedulePreview.ok ? schedulePreview.error : null;
  const showSessionDuration = scheduleMode === "random" || patternConstraint === "fitTotal";

  return (
    <div className="mx-auto mt-8 w-full min-w-0 space-y-8 text-left transition-opacity duration-ds ease-ds-out">
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
          className="mx-auto w-full min-w-0 max-w-7xl px-4 py-10 sm:px-10"
        >
          <div
            className={
              setupIntervals.length > 0
                ? "lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] lg:items-start lg:gap-x-10 lg:gap-y-0 xl:gap-x-14"
                : "lg:w-full"
            }
          >
            <div className="mx-auto flex w-full min-w-0 max-w-md flex-col gap-10 sm:max-w-lg lg:mx-0 lg:min-w-0 lg:max-w-none lg:flex-1">
              <div className="flex flex-col gap-4">
                <SetupSectionTitle step={1}>Schedule</SetupSectionTitle>
                <SegmentedControl
                  label="Schedule type"
                  showLabel={false}
                  value={scheduleMode}
                  options={[
                    { value: "pattern", label: "Pattern" },
                    { value: "random", label: "Random spread" },
                  ]}
                  onChange={setScheduleMode}
                />

                {scheduleMode === "pattern" ? (
                  <div className="mt-4">
                    <PatternScheduleEditor
                      slots={patternSlots}
                      onSlotsChange={setPatternSlots}
                      patternConstraint={patternConstraint}
                      onPatternConstraintChange={setPatternConstraint}
                    />
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-4 border-t border-ds-divider pt-10">
                <SetupSectionTitle step={2}>Session</SetupSectionTitle>
                <div
                  className={`grid w-full min-w-0 gap-4 [&>*]:min-w-0 ${
                    showSessionDuration
                      ? "max-w-2xl grid-cols-1 justify-items-stretch sm:grid-cols-3 sm:justify-items-start sm:gap-x-5 [&>*]:sm:max-w-[11.25rem]"
                      : "max-w-[17.5rem] grid-cols-1 justify-items-start sm:max-w-xs"
                  }`}
                >
                  {showSessionDuration && (
                    <>
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
                    </>
                  )}
                  <NumberInput
                    layout="fill"
                    label="Rings"
                    value={rings}
                    min={1}
                    max={500}
                    onChange={setRings}
                    className={showSessionDuration ? "min-w-0" : "w-full min-w-0"}
                  />
                </div>

                {scheduleMode === "random" && (
                  <div className="mt-6 flex flex-col gap-3 border-t border-ds-divider pt-8">
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-ds-soft sm:text-[11px] sm:tracking-[0.13em]">
                      Spread
                    </p>
                    <VariabilitySlider
                      className="w-full max-w-md lg:mx-0"
                      value={variabilityPct}
                      onChange={setVariabilityPct}
                    />
                    <ControlButton
                      type="button"
                      variant="secondary"
                      className="!min-h-10 w-full max-w-xs py-3 lg:mx-0"
                      onClick={() => {
                        primeAudioFromUserGesture();
                        setShuffleNonce((n) => n + 1);
                      }}
                    >
                      New shuffle
                    </ControlButton>
                  </div>
                )}
              </div>

              {setupScheduleError && (
                <p
                  className="mx-auto max-w-md text-left text-sm leading-snug text-ds-body lg:mx-0"
                  role="alert"
                >
                  {setupScheduleError}
                </p>
              )}

              <div className="flex flex-col gap-4 border-t border-ds-divider pt-10">
                <SetupSectionTitle step={3}>Sound</SetupSectionTitle>
                <IntervalSoundPanel
                  className="max-w-md lg:justify-start lg:pt-0"
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
              </div>
              <div className="mx-auto flex w-full max-w-md flex-col gap-3 border-t border-ds-divider pt-10 lg:mx-0 lg:max-w-sm">
                <ControlButton
                  className="!min-w-0 w-full gap-2 py-4 text-[11px] tracking-[0.14em] sm:text-xs sm:tracking-[0.16em]"
                  aria-label="Start interval session"
                  disabled={!schedulePreview.ok}
                  onClick={beginPlayback}
                >
                  <span aria-hidden className="inline-block translate-y-px text-[0.65em] opacity-90">
                    ▶
                  </span>
                  Start session
                </ControlButton>
              </div>
            </div>

            {setupIntervals.length > 0 && (
              <div
                className={[
                  "mt-8 flex min-h-0 min-w-0 flex-col border-t border-ds-divider pt-6",
                  /* Viewport-capped height → list scrolls inside, not via page body */
                  "h-[min(68dvh,calc(100dvh-12rem))] max-h-[calc(100dvh-12rem)]",
                  "lg:mt-0 lg:sticky lg:top-[max(0.75rem,calc(5.25rem+env(safe-area-inset-top)))] lg:z-10 lg:self-start",
                  "lg:h-[calc(100dvh-6.5rem)] lg:max-h-[calc(100dvh-6.5rem)]",
                  "lg:border-t-0 lg:pl-4 lg:pt-0",
                ].join(" ")}
              >
                <IntervalSchedulePanel
                  intervalsMs={setupIntervals}
                  phaseLabels={setupPhaseLabels}
                  variant="embedded"
                  fillHeight
                />
              </div>
            )}
          </div>
        </section>
      )}

      {phase === "play" && sched.length > 0 && (
        <section
          aria-label="Playback"
          className="mx-auto mb-[max(0.5rem,env(safe-area-inset-bottom))] w-full min-w-0 max-w-6xl px-4 py-10 sm:px-10"
        >
          <div className="lg:grid lg:min-h-0 lg:grid-cols-3 lg:items-start lg:gap-x-12">
            <div className="order-2 mt-8 flex min-w-0 flex-col gap-8 border-t border-ds-divider pt-8 lg:order-1 lg:col-span-2 lg:mt-0 lg:border-t-0 lg:pr-6 lg:pt-0">
              <div className="mx-auto flex w-full min-w-0 max-w-md flex-col gap-8 lg:mx-0 lg:max-w-none">
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

                <div className="flex w-full flex-col gap-3 lg:flex-row lg:gap-4">
                  <ControlButton
                    className="!min-w-0 w-full gap-2 py-4 lg:flex-1"
                    aria-label={running ? "Pause" : "Resume"}
                    onClick={() => {
                      primeAudioFromUserGesture();
                      if (running) pausePlayback();
                      else resumePlayback();
                      persistTick();
                    }}
                  >
                    {running ? (
                      <>
                        <span aria-hidden className="text-[0.95em] opacity-95">
                          ⏸
                        </span>
                        Pause
                      </>
                    ) : (
                      <>
                        <span aria-hidden className="inline-block translate-y-px text-[0.65em] opacity-90">
                          ▶
                        </span>
                        Resume
                      </>
                    )}
                  </ControlButton>
                  <ControlButton
                    className="!min-w-0 w-full gap-2 py-4 lg:flex-1"
                    variant="secondary"
                    aria-label="Stop session"
                    onClick={() => {
                      primeAudioFromUserGesture();
                      stopSession();
                    }}
                  >
                    <span aria-hidden className="text-[0.95em]">
                      ⏹
                    </span>
                    Stop
                  </ControlButton>
                </div>
              </div>
            </div>

            <div
              className={[
                "order-1 flex min-h-0 min-w-0 flex-col lg:order-2 lg:col-span-1",
                "h-[min(68dvh,calc(100dvh-12rem))] max-h-[calc(100dvh-12rem)]",
                "lg:sticky lg:top-[max(0.75rem,calc(5.25rem+env(safe-area-inset-top)))] lg:z-10 lg:self-start",
                "lg:h-[calc(100dvh-6.5rem)] lg:max-h-[calc(100dvh-6.5rem)]",
                "lg:pl-2",
              ].join(" ")}
            >
              <IntervalSchedulePanel
                intervalsMs={sched}
                phaseLabels={playbackPhaseLabels}
                activeIndex={currentIndex}
                remainingMs={remainingMs}
                flashActive={flashRing}
                prefersReducedMotion={prefersReducedMotion}
                variant="embedded"
                fillHeight
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
                Ring {i + 1}
                {scheduleMode === "pattern" && patternSlots.length > 0
                  ? ` · ${phaseLabelsForSchedule(actualSegments.length, patternSlots.length)[i] ?? ""}`
                  : ""}
                : {formatMmSs(ms)}
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
