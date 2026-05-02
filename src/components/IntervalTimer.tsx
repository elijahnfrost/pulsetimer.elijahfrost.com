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
  normalizeDurationParts,
  normalizeHmsParts,
  totalMsFromHms,
  totalMsFromNormalizedParts,
} from "@/lib/normalizeDurationParts";
import { useAccurateTimer } from "@/hooks/useAccurateTimer";
import { primeAudioFromUserGesture, useAudioAlert } from "@/hooks/useAudioAlert";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import {
  ControlButton,
  ControlsRow,
  scheduleBarPrimaryActionClass,
  scheduleBarSecondaryActionClass,
  scheduleHeaderBarShellClass,
  scheduleHeaderTimeClass,
} from "./Controls";
import { BigRow } from "./BigRow";
import { BigNumber, HmsClock } from "./BigEditors";
import { IntervalSchedulePanel } from "./IntervalSchedulePanel";
import { IntervalSoundPanel } from "./IntervalSoundPanel";
import {
  PatternScheduleEditor,
  type PatternConstraint,
  type PatternPhasePersist,
} from "./PatternScheduleEditor";
import { SetupSubStepTitle } from "./SetupSectionTitle";
import { VariabilitySlider } from "./VariabilitySlider";

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/** Stroke play glyph — aligns with checklist / divider line weight elsewhere. */
const PlayStrokeIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M8 5.25v13.5L18.75 12 8 5.25z" />
  </svg>
);

const PauseFillIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="6" y="5" width="4.75" height="14" rx="1" opacity="0.92" />
    <rect x="13.25" y="5" width="4.75" height="14" rx="1" opacity="0.92" />
  </svg>
);

const StopStrokeIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    aria-hidden
  >
    <rect x="7" y="7" width="10" height="10" rx="0.75" />
  </svg>
);

function IntervalScheduleHeaderStart({
  totalMs,
  disabled,
  onClick,
}: {
  totalMs: number;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className={scheduleHeaderBarShellClass}>
      <button
        type="button"
        className={scheduleBarPrimaryActionClass}
        aria-label="Start interval session"
        disabled={disabled}
        onClick={onClick}
      >
        <PlayStrokeIcon className="h-[15px] w-[15px] shrink-0 text-ds-soft sm:h-4 sm:w-4" />
        <span>Start</span>
      </button>
      <span className={scheduleHeaderTimeClass}>{formatMmSs(totalMs)}</span>
    </div>
  );
}

function BigOption({ label, title, description, isActive, onClick, borderBottom }: { label: string, title: string, description?: string, isActive: boolean, onClick: () => void, borderBottom?: boolean }) {
  return (
    <BigRow
      label={label}
      onClick={onClick}
      isActive={isActive}
      borderBottom={borderBottom}
      rightAction={
        isActive ? <CheckIcon className="h-6 w-6 text-ds-fg" /> : <div className="h-6 w-6" />
      }
    >
      <div className="flex flex-col gap-1 pl-2 sm:pl-4">
        <span className={`font-mono text-[clamp(1.1rem,2.5vmin,1.4rem)] uppercase tracking-[0.08em] ${isActive ? "text-ds-fg font-medium" : "text-ds-soft font-light"}`}>
          {title}
        </span>
        {description && (
          <span className={`text-[10px] sm:text-[11px] uppercase tracking-[0.1em] ${isActive ? "text-ds-soft" : "text-ds-muted"}`}>
            {description}
          </span>
        )}
      </div>
    </BigRow>
  );
}

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
    { hours: 0, minutes: 5, secondsPart: 0 },
    { hours: 0, minutes: 2, secondsPart: 0 },
  ];
}

function normalizePatternSlots(raw: unknown): PatternPhasePersist[] {
  if (!Array.isArray(raw) || raw.length === 0) return defaultPatternSlots();
  const out: PatternPhasePersist[] = [];
  for (let i = 0; i < Math.min(MAX_PATTERN_PHASES, raw.length); i++) {
    const item = raw[i] as { hours?: number; minutes?: number; secondsPart?: number };
    if (typeof item.hours === "number") {
      out.push(
        normalizeHmsParts(item.hours, item.minutes ?? 0, item.secondsPart ?? 0)
      );
    } else {
      const norm = normalizeDurationParts(item?.minutes ?? 0, item?.secondsPart ?? 0);
      out.push(normalizeHmsParts(0, norm.minutes, norm.secondsPart));
    }
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
    const weightsMs = patternSlots.map((s) => totalMsFromHms(s.hours, s.minutes, s.secondsPart));

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

  const sessionPlanTotalMs = useMemo(
    () => (sched.length === 0 ? 0 : sched.reduce((a, b) => a + b, 0)),
    [sched],
  );

  const sessionElapsedPlannedMs = useMemo(() => {
    if (phase !== "play" || sched.length === 0) return 0;
    const idx = Math.max(0, Math.min(currentIndex, sched.length - 1));
    const before = sched.slice(0, idx).reduce((a, b) => a + b, 0);
    const planned = sched[idx] ?? 0;
    const remaining = Math.max(0, remainingMs);
    const consumed = Math.min(planned, Math.max(0, planned - remaining));
    return before + consumed;
  }, [phase, sched, currentIndex, remainingMs]);

  const sessionPlanProgressPct =
    sessionPlanTotalMs > 0
      ? Math.min(100, Math.max(0, (sessionElapsedPlannedMs / sessionPlanTotalMs) * 100))
      : 0;

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

  const scheduleSubStepCount = scheduleMode === "pattern" ? 3 : 1;
  const sessionChapterMark = scheduleSubStepCount + 1;
  const soundChapterMark = scheduleSubStepCount + 2;

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
          <div className="lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] lg:items-start lg:gap-x-8 lg:gap-y-0 xl:gap-x-12">
            <div className="mx-auto flex w-full min-w-0 max-w-md flex-col gap-8 sm:max-w-lg lg:mx-0 lg:min-w-0 lg:max-w-none lg:flex-1">
              <div className="flex flex-col gap-0">
                <div className="flex flex-col gap-5">
                  <SetupSubStepTitle notation="1.">Pattern or random spread</SetupSubStepTitle>
                  <div className="mt-2 flex w-full min-w-0 flex-col overflow-hidden rounded-md border border-ds-divider">
                    <BigOption
                      label="PAT"
                      title="Pattern"
                      description="Repeating A→B→… cycle"
                      isActive={scheduleMode === "pattern"}
                      onClick={() => setScheduleMode("pattern")}
                      borderBottom
                    />
                    <BigOption
                      label="RND"
                      title="Random"
                      description="Jittered time per ring"
                      isActive={scheduleMode === "random"}
                      onClick={() => setScheduleMode("random")}
                    />
                  </div>
                </div>

                {scheduleMode === "pattern" ? (
                  <>
                    <div className="mt-14 flex flex-col gap-4 pt-14 sm:mt-16 sm:pt-16">
                      <SetupSubStepTitle notation="2.">Scale to session or fixed lengths</SetupSubStepTitle>
                      <div className="mt-2 flex w-full min-w-0 flex-col overflow-hidden rounded-md border border-ds-divider">
                        <BigOption
                          label="FIT"
                          title="Scale"
                          description="Divides session total"
                          isActive={patternConstraint === "fitTotal"}
                          onClick={() => setPatternConstraint("fitTotal")}
                          borderBottom
                        />
                        <BigOption
                          label="FIX"
                          title="Fixed"
                          description="Exact phase lengths"
                          isActive={patternConstraint === "fixed"}
                          onClick={() => setPatternConstraint("fixed")}
                        />
                      </div>
                    </div>

                    <div className="mt-14 flex flex-col gap-5 pt-14 sm:mt-16 sm:gap-6 sm:pt-16">
                      <SetupSubStepTitle notation="3.">Phase durations</SetupSubStepTitle>
                      <PatternScheduleEditor slots={patternSlots} onSlotsChange={setPatternSlots} />
                    </div>
                  </>
                ) : null}
              </div>

              <div className="flex w-full min-w-0 flex-col gap-4 pt-12 sm:pt-14">
                <SetupSubStepTitle notation={`${sessionChapterMark}.`}>Session</SetupSubStepTitle>
                <div className="flex w-full min-w-0 flex-col overflow-hidden rounded-md border border-ds-divider">
                  {showSessionDuration && (
                    <BigRow label="DUR" borderBottom>
                      <HmsClock
                        phaseLetter="Session"
                        hours={Math.floor(minutes / 60)}
                        minutes={minutes % 60}
                        seconds={secondsPart}
                        onSetHms={(h, m, s) => applySessionDuration(h * 60 + m, s)}
                      />
                    </BigRow>
                  )}
                  <BigRow label="RNG">
                    <BigNumber
                      label="Rings"
                      value={rings}
                      unitLabel="Rings"
                      onChange={setRings}
                    />
                  </BigRow>
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
                      className="!min-h-12 w-full max-w-xs py-3.5 lg:mx-0"
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

              <div className="flex w-full min-w-0 flex-col gap-4 pt-12 sm:pt-14">
                <SetupSubStepTitle notation={`${soundChapterMark}.`}>Sound</SetupSubStepTitle>
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
            </div>

            <div
              className={[
                "mt-8 flex min-h-0 min-w-0 flex-col border-t border-ds-divider pt-6",
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
                headerEnd={
                  <IntervalScheduleHeaderStart
                    totalMs={
                      schedulePreview.ok ? schedulePreview.intervalsMs.reduce((a, b) => a + b, 0) : 0
                    }
                    disabled={!schedulePreview.ok}
                    onClick={beginPlayback}
                  />
                }
              />
            </div>
          </div>
        </section>
      )}

      {phase === "play" && sched.length > 0 && (
        <section
          aria-label="Playback"
          className="mx-auto mb-[max(0.5rem,env(safe-area-inset-bottom))] w-full min-w-0 max-w-7xl px-4 py-10 sm:px-10"
        >
          {/* Same grid as setup — primary column first (sound), schedule second → no holistic jump at start */}
          <div className="lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] lg:items-start lg:gap-x-8 lg:gap-y-0 xl:gap-x-12">
            <div className="mx-auto flex w-full min-w-0 max-w-md flex-col gap-8 sm:max-w-lg lg:mx-0 lg:min-w-0 lg:max-w-none lg:flex-1">
              <div className="flex flex-col gap-5">
                <SetupSubStepTitle notation="1.">While running</SetupSubStepTitle>
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
              </div>
            </div>

            <div
              className={[
                "mt-8 flex min-h-0 min-w-0 flex-col border-t border-ds-divider pt-6",
                "h-[min(68dvh,calc(100dvh-12rem))] max-h-[calc(100dvh-12rem)]",
                "lg:mt-0 lg:sticky lg:top-[max(0.75rem,calc(5.25rem+env(safe-area-inset-top)))] lg:z-10 lg:self-start",
                "lg:h-[calc(100dvh-6.5rem)] lg:max-h-[calc(100dvh-6.5rem)]",
                "lg:border-t-0 lg:pl-4 lg:pt-0",
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
                headerEnd={
                  <div className={scheduleHeaderBarShellClass}>
                    <div className="flex min-w-0 shrink items-center gap-2 sm:gap-2.5">
                      {running ? (
                        <button
                          type="button"
                          className={scheduleBarPrimaryActionClass}
                          aria-label="Pause"
                          onClick={() => {
                            primeAudioFromUserGesture();
                            pausePlayback();
                            persistTick();
                          }}
                        >
                          <PauseFillIcon className="h-3.5 w-3.5 shrink-0 text-ds-soft sm:h-4 sm:w-4" />
                          <span>Pause</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={scheduleBarPrimaryActionClass}
                          aria-label="Resume"
                          onClick={() => {
                            primeAudioFromUserGesture();
                            resumePlayback();
                            persistTick();
                          }}
                        >
                          <PlayStrokeIcon className="h-[15px] w-[15px] shrink-0 text-ds-soft sm:h-4 sm:w-4" />
                          <span>Resume</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className={scheduleBarSecondaryActionClass}
                        aria-label="Stop session"
                        onClick={() => {
                          primeAudioFromUserGesture();
                          stopSession();
                        }}
                      >
                        <StopStrokeIcon className="h-[15px] w-[15px] shrink-0 text-ds-soft sm:h-4 sm:w-4" />
                        <span>Stop</span>
                      </button>
                    </div>
                    <p
                      className={scheduleHeaderTimeClass}
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(sessionPlanProgressPct)}
                      aria-valuetext={`${formatMmSs(sessionElapsedPlannedMs)} elapsed of ${formatMmSs(sessionPlanTotalMs)}`}
                    >
                      {formatMmSs(sessionElapsedPlannedMs)}
                      <span className="text-ds-dim"> / </span>
                      {formatMmSs(sessionPlanTotalMs)}
                    </p>
                  </div>
                }
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
