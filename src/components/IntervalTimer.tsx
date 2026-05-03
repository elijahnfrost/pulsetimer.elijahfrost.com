"use client";

import {
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ShortcutHandles } from "@/types/hotkeys";
import {
  MAX_PATTERN_PHASES,
  buildPhaseIndexSequenceFromOccurrences,
  buildPatternScheduleFromPhaseIndices,
  buildRandomSchedule,
  fitIntervalsToTargetTotal,
  mixSeed,
  mulberry32,
  multiplyIntervalsToTarget,
  normalizeOccurrenceCount,
  phaseLabelsFromIndices,
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
  type PatternOccurrenceMode,
  type PatternPhasePersist,
  type PatternScaleStrategy,
} from "./PatternScheduleEditor";
import { SetupSubStepTitle } from "./SetupSectionTitle";
import { VariabilitySlider } from "./VariabilitySlider";

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
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
  <svg
    className={className}
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
  >
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

function IntervalScheduleTransportBar({
  state,
  totalMs,
  elapsedMs,
  startDisabled,
  onStart,
  onPause,
  onResume,
  onStop,
}: {
  state: "setup" | "running" | "paused";
  totalMs: number;
  elapsedMs: number;
  startDisabled?: boolean;
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
}) {
  const playing = state !== "setup";

  const primaryLabel =
    state === "running" ? "Pause" : state === "paused" ? "Resume" : "Start";

  const onPrimaryClick =
    state === "running" ? onPause : state === "paused" ? onResume : onStart;

  return (
    <div className={scheduleHeaderBarShellClass}>
      <button
        type="button"
        className={scheduleBarPrimaryActionClass}
        aria-label={`${primaryLabel} interval session`}
        disabled={state === "setup" ? startDisabled : false}
        onClick={onPrimaryClick}
      >
        {state === "running" ? (
          <PauseFillIcon className="h-[13px] w-[13px] shrink-0 text-current" />
        ) : (
          <PlayStrokeIcon className="h-[13px] w-[13px] shrink-0 text-current" />
        )}
        <span>{primaryLabel}</span>
      </button>

      {playing ? (
        <button
          type="button"
          className={scheduleBarSecondaryActionClass}
          aria-label="Stop session"
          onClick={onStop}
        >
          <StopStrokeIcon className="h-[13px] w-[13px] shrink-0 text-current" />
          <span>Stop</span>
        </button>
      ) : (
        <span
          className={`${scheduleBarSecondaryActionClass} pointer-events-none invisible`}
          aria-hidden
        >
          Stop
        </span>
      )}

      <p
        className={scheduleHeaderTimeClass}
        role={playing ? "progressbar" : undefined}
        aria-valuemin={playing ? 0 : undefined}
        aria-valuemax={playing ? 100 : undefined}
        aria-valuenow={
          playing ? Math.round(totalMs > 0 ? (elapsedMs / totalMs) * 100 : 0) : undefined
        }
        aria-valuetext={
          playing
            ? `${formatMmSs(elapsedMs)} elapsed of ${formatMmSs(totalMs)}`
            : undefined
        }
      >
        {formatMmSs(Math.max(0, elapsedMs))}
        <span className="text-ds-dim"> / </span>
        {formatMmSs(Math.max(0, totalMs))}
      </p>
    </div>
  );
}

function BigOption({
  label,
  title,
  description,
  isActive,
  onClick,
  borderBottom,
}: {
  label: string;
  title: string;
  description?: string;
  isActive: boolean;
  onClick: () => void;
  borderBottom?: boolean;
}) {
  return (
    <BigRow
      label={label}
      onClick={onClick}
      isActive={isActive}
      borderBottom={borderBottom}
      rightAction={
        isActive ? (
          <CheckIcon className="h-6 w-6 text-ds-fg" />
        ) : (
          <div className="h-6 w-6" />
        )
      }
    >
      <div className="flex flex-col gap-1 pl-2 sm:pl-4">
        <span
          className={`font-mono text-[clamp(1.1rem,2.5vmin,1.4rem)] uppercase tracking-[0.08em] ${isActive ? "text-ds-fg font-medium" : "text-ds-soft font-light"}`}
        >
          {title}
        </span>
        {description && (
          <span
            className={`text-[10px] sm:text-[11px] uppercase tracking-[0.1em] ${isActive ? "text-ds-soft" : "text-ds-muted"}`}
          >
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
  resume: null | {
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
  patternOccurrenceMode: PatternOccurrenceMode;
  patternScaleStrategy: PatternScaleStrategy;
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
  resume: null | {
    index: number;
    segmentDeadlineTs: number | null;
    pausedRemainMs: number | null;
    actualMs: number[];
  };
};

function defaultPatternSlots(): PatternPhasePersist[] {
  return [
    { hours: 0, minutes: 5, secondsPart: 0, occurrences: 1 },
    { hours: 0, minutes: 2, secondsPart: 0, occurrences: 1 },
  ];
}

function normalizePatternSlots(raw: unknown): PatternPhasePersist[] {
  if (!Array.isArray(raw) || raw.length === 0) return defaultPatternSlots();
  const out: PatternPhasePersist[] = [];
  for (let i = 0; i < Math.min(MAX_PATTERN_PHASES, raw.length); i++) {
    const item = raw[i] as {
      hours?: number;
      minutes?: number;
      secondsPart?: number;
      occurrences?: number;
    };
    const occurrences = normalizeOccurrenceCount(item?.occurrences ?? 1);
    if (typeof item.hours === "number") {
      out.push({
        ...normalizeHmsParts(item.hours, item.minutes ?? 0, item.secondsPart ?? 0),
        occurrences,
      });
    } else {
      const norm = normalizeDurationParts(item?.minutes ?? 0, item?.secondsPart ?? 0);
      out.push({ ...normalizeHmsParts(0, norm.minutes, norm.secondsPart), occurrences });
    }
  }
  return out.length > 0 ? out : defaultPatternSlots();
}

function normalizeOccurrenceMode(raw: unknown): PatternOccurrenceMode {
  return raw === "perItem" ? "perItem" : "total";
}

function normalizeScaleStrategy(raw: unknown): PatternScaleStrategy {
  if (raw === "none" || raw === "fitClosest" || raw === "multiply") {
    return raw;
  }
  return "none";
}

function migrateV1(s: PersistShapeV1): PersistShape {
  return {
    version: 2,
    scheduleMode: "random",
    patternConstraint: "cycle",
    patternOccurrenceMode: "total",
    patternScaleStrategy: "none",
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
    const scheduleMode: ScheduleMode =
      o.scheduleMode === "pattern" ? "pattern" : "random";

    const rawConstraint = o.patternConstraint;
    const patternConstraint: PatternConstraint =
      rawConstraint === "fixed" || rawConstraint === "fixedLength"
        ? "fixedLength"
        : rawConstraint === "fitTotal"
          ? "fixedLength"
          : "cycle";

    const patternOccurrenceMode = normalizeOccurrenceMode(o.patternOccurrenceMode);

    const patternScaleStrategy =
      rawConstraint === "fitTotal"
        ? "fitClosest"
        : normalizeScaleStrategy(o.patternScaleStrategy);

    const shuffleNonce =
      typeof o.shuffleNonce === "number" && Number.isFinite(o.shuffleNonce)
        ? Math.max(0, Math.floor(o.shuffleNonce))
        : 0;

    return {
      version: 2,
      scheduleMode,
      patternConstraint,
      patternOccurrenceMode,
      patternScaleStrategy,
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
        o.phase === "play" || o.phase === "complete" || o.phase === "setup"
          ? o.phase
          : "setup",
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
  | {
      ok: true;
      intervalsMs: number[];
      phaseLabels: string[];
      remainderMs: number;
      strategyUsed: "none" | "fitClosest" | "multiply";
      slotDeltaMs: number[];
    }
  | { ok: false; error: string };

type Props = {
  actionsRef?: MutableRefObject<ShortcutHandles | null>;
  onActivityChange?: (active: boolean) => void;
};

export function IntervalTimer({ actionsRef, onActivityChange }: Props) {
  const playChime = useAudioAlert();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("pattern");
  const [patternConstraint, setPatternConstraint] = useState<PatternConstraint>("cycle");
  const [patternOccurrenceMode, setPatternOccurrenceMode] =
    useState<PatternOccurrenceMode>("total");
  const [patternScaleStrategy, setPatternScaleStrategy] =
    useState<PatternScaleStrategy>("none");
  const [patternSlots, setPatternSlots] =
    useState<PatternPhasePersist[]>(defaultPatternSlots);
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

  const [remainingMs, running, ctr] = useAccurateTimer(() =>
    onSegmentCompleteRef.current()
  );

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
    if (scheduleMode === "random") {
      const n = ringCount;
      const v = variabilityPct / 100;
      const seed = mixSeed([totalMsPlanned, n, variabilityPct, shuffleNonce]);
      const rng = mulberry32(seed);
      const res = buildRandomSchedule(totalMsPlanned, n, v, rng);
      if (!res.ok) {
        return { ok: false, error: res.error };
      }
      const blanks = Array.from({ length: n }, () => "");
      return {
        ok: true,
        intervalsMs: res.intervalsMs,
        phaseLabels: blanks,
        remainderMs: 0,
        strategyUsed: "none",
        slotDeltaMs: [],
      };
    }

    const lengthsMs = patternSlots.map((s) =>
      totalMsFromHms(s.hours, s.minutes, s.secondsPart)
    );
    const occurrences = patternSlots.map((s) => normalizeOccurrenceCount(s.occurrences));

    const buildCyclePhaseIndices = () =>
      buildPhaseIndexSequenceFromOccurrences(occurrences);

    const buildFixedLengthBasePhaseIndices = () => {
      if (patternOccurrenceMode === "perItem") {
        return buildPhaseIndexSequenceFromOccurrences(occurrences);
      }
      const kk = Math.max(1, patternSlots.length);
      return {
        ok: true as const,
        phaseIndices: Array.from({ length: kk }, (_, i) => i),
      };
    };

    const strategyUsed = patternScaleStrategy;

    if (patternConstraint === "cycle") {
      const seq = buildCyclePhaseIndices();
      if (!seq.ok) {
        return { ok: false, error: seq.error };
      }
      const base = buildPatternScheduleFromPhaseIndices(seq.phaseIndices, lengthsMs);
      if (!base.ok) {
        return { ok: false, error: base.error };
      }
      return {
        ok: true,
        intervalsMs: base.intervalsMs,
        phaseLabels: phaseLabelsFromIndices(seq.phaseIndices),
        remainderMs: 0,
        strategyUsed: "none",
        slotDeltaMs: patternSlots.map(() => 0),
      };
    }

    const baseSeq = buildFixedLengthBasePhaseIndices();
    if (!baseSeq.ok) {
      return { ok: false, error: baseSeq.error };
    }

    const base = buildPatternScheduleFromPhaseIndices(baseSeq.phaseIndices, lengthsMs);
    if (!base.ok) {
      return { ok: false, error: base.error };
    }

    const baseLabels = phaseLabelsFromIndices(baseSeq.phaseIndices);

    if (strategyUsed === "fitClosest" || strategyUsed === "multiply") {
      const multiplied = multiplyIntervalsToTarget(totalMsPlanned, base.intervalsMs);
      if (!multiplied.ok) {
        return { ok: false, error: multiplied.error };
      }

      const repeatedPhaseIndices: number[] = [];
      for (let i = 0; i < multiplied.repeats; i++) {
        repeatedPhaseIndices.push(...baseSeq.phaseIndices);
      }
      const repeatedLabels = phaseLabelsFromIndices(repeatedPhaseIndices);

      if (strategyUsed === "multiply") {
        return {
          ok: true,
          intervalsMs: multiplied.intervalsMs,
          phaseLabels: repeatedLabels,
          remainderMs: multiplied.remainderMs,
          strategyUsed: "multiply",
          slotDeltaMs: patternSlots.map(() => 0),
        };
      }

      const fit = fitIntervalsToTargetTotal(totalMsPlanned, multiplied.intervalsMs);
      if (!fit.ok) {
        return { ok: false, error: fit.error };
      }
      const fitTotal = fit.intervalsMs.reduce((a, b) => a + b, 0);
      const deltaSumBySlot = patternSlots.map(() => 0);
      const hitCountBySlot = patternSlots.map(() => 0);
      for (let i = 0; i < repeatedPhaseIndices.length; i++) {
        const phaseIdx = repeatedPhaseIndices[i]!;
        deltaSumBySlot[phaseIdx] =
          (deltaSumBySlot[phaseIdx] ?? 0) +
          ((fit.intervalsMs[i] ?? multiplied.intervalsMs[i] ?? 0) -
            (multiplied.intervalsMs[i] ?? 0));
        hitCountBySlot[phaseIdx] = (hitCountBySlot[phaseIdx] ?? 0) + 1;
      }
      const slotDeltaMs = deltaSumBySlot.map((sum, idx) => {
        const c = hitCountBySlot[idx] ?? 0;
        return c > 0 ? Math.round(sum / c) : 0;
      });

      return {
        ok: true,
        intervalsMs: fit.intervalsMs,
        phaseLabels: repeatedLabels,
        remainderMs: totalMsPlanned - fitTotal,
        strategyUsed: "fitClosest",
        slotDeltaMs,
      };
    }

    return {
      ok: true,
      intervalsMs: base.intervalsMs,
      phaseLabels: baseLabels,
      remainderMs: 0,
      strategyUsed: "none",
      slotDeltaMs: patternSlots.map(() => 0),
    };
  }, [
    scheduleMode,
    patternConstraint,
    patternOccurrenceMode,
    patternScaleStrategy,
    patternSlots,
    ringCount,
    totalMsPlanned,
    variabilityPct,
    shuffleNonce,
  ]);

  const persistTick = useCallback(() => {
    const intervals =
      intervalsRef.current.length > 0 ? intervalsRef.current : (scheduleMs ?? []);
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
      patternOccurrenceMode,
      patternScaleStrategy,
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
    patternOccurrenceMode,
    patternScaleStrategy,
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
      setPatternOccurrenceMode(s.patternOccurrenceMode);
      setPatternScaleStrategy(s.patternScaleStrategy);
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
    patternOccurrenceMode,
    patternScaleStrategy,
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
      alert(
        schedulePreview.ok ? "Fix the schedule before starting." : schedulePreview.error
      );
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

  const phaseLabelsForCurrentSchedule =
    scheduleMode === "pattern" && schedulePreview.ok
      ? schedulePreview.phaseLabels
      : undefined;

  const playbackPhaseLabels =
    scheduleMode === "pattern" && sched.length > 0
      ? phaseLabelsForCurrentSchedule?.slice(0, sched.length)
      : undefined;

  const completionPhaseLabels =
    scheduleMode === "pattern" && sched.length > 0
      ? phaseLabelsForCurrentSchedule?.slice(0, actualSegments.length)
      : undefined;

  const sessionPlanTotalMs = useMemo(
    () => (sched.length === 0 ? 0 : sched.reduce((a, b) => a + b, 0)),
    [sched]
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

  const setupIntervals =
    phase === "setup" && schedulePreview.ok
      ? schedulePreview.intervalsMs
      : (scheduleMs ?? []);
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

  const setupScheduleError =
    phase === "setup" && !schedulePreview.ok ? schedulePreview.error : null;

  const showSessionDuration =
    scheduleMode === "random" ||
    (scheduleMode === "pattern" &&
      patternConstraint === "fixedLength" &&
      patternScaleStrategy !== "none");

  const showSessionRings = scheduleMode === "random";

  const setupRemainderNotice =
    phase === "setup" &&
    scheduleMode === "pattern" &&
    schedulePreview.ok &&
    schedulePreview.strategyUsed === "multiply" &&
    schedulePreview.remainderMs !== 0
      ? schedulePreview.remainderMs > 0
        ? `Left: ${formatMmSs(schedulePreview.remainderMs)}`
        : `Over: ${formatMmSs(Math.abs(schedulePreview.remainderMs))}`
      : null;

  const showSessionSection = showSessionDuration || showSessionRings;
  const showVariationSection = scheduleMode === "random";

  let chapter = 2;
  const sessionChapterMark = showSessionSection ? chapter++ : null;
  const spreadChapterMark = showVariationSection ? chapter++ : null;
  const soundChapterMark = chapter;

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
            <div className="mx-auto flex w-full min-w-0 max-w-md flex-col gap-6 sm:max-w-lg lg:mx-0 lg:min-w-0 lg:max-w-none lg:flex-1">
              <div className="flex flex-col gap-0">
                <div className="flex flex-col gap-5">
                  <SetupSubStepTitle notation="1.">Timing style</SetupSubStepTitle>
                  <div className="mt-2 flex w-full min-w-0 flex-col overflow-hidden rounded-md border border-ds-divider">
                    <BigOption
                      label="SEQ"
                      title="Sequenced"
                      description="Follow your item order"
                      isActive={scheduleMode === "pattern"}
                      onClick={() => setScheduleMode("pattern")}
                      borderBottom
                    />
                    <BigOption
                      label="RND"
                      title="Randomized"
                      description="Vary each ring time"
                      isActive={scheduleMode === "random"}
                      onClick={() => setScheduleMode("random")}
                    />
                  </div>
                </div>

                {scheduleMode === "pattern" ? (
                  <>
                    <div className="mt-8 flex flex-col gap-4 pt-6 sm:mt-10 sm:pt-8">
                      <SetupSubStepTitle notation="1A.">Length mode</SetupSubStepTitle>
                      <div className="mt-2 flex w-full min-w-0 flex-col overflow-hidden rounded-md border border-ds-divider">
                        <BigOption
                          label="CNT"
                          title="Count-based"
                          description="Use item counts and fixed times"
                          isActive={patternConstraint === "cycle"}
                          onClick={() => {
                            setPatternConstraint("cycle");
                            setPatternScaleStrategy("none");
                          }}
                          borderBottom
                        />
                        <BigOption
                          label="LEN"
                          title="Target length"
                          description="Match a session total"
                          isActive={patternConstraint === "fixedLength"}
                          onClick={() => setPatternConstraint("fixedLength")}
                        />
                      </div>
                    </div>

                    {patternConstraint === "fixedLength" ? (
                      <div className="mt-8 flex flex-col gap-4 pt-6 sm:mt-10 sm:pt-8">
                        <SetupSubStepTitle notation="1B.">Count input</SetupSubStepTitle>
                        <div className="mt-2 flex w-full min-w-0 flex-col overflow-hidden rounded-md border border-ds-divider">
                          <BigOption
                            label="TOT"
                            title="Total count"
                            description="One total across all items"
                            isActive={patternOccurrenceMode === "total"}
                            onClick={() => setPatternOccurrenceMode("total")}
                            borderBottom
                          />
                          <BigOption
                            label="PER"
                            title="Per-item count"
                            description="Set count for each item"
                            isActive={patternOccurrenceMode === "perItem"}
                            onClick={() => setPatternOccurrenceMode("perItem")}
                          />
                        </div>
                      </div>
                    ) : null}

                    {patternConstraint === "fixedLength" ? (
                      <div className="mt-8 flex flex-col gap-4 pt-6 sm:mt-10 sm:pt-8">
                        <SetupSubStepTitle notation="1C.">Fit method</SetupSubStepTitle>
                        <div className="mt-2 flex w-full min-w-0 flex-col overflow-hidden rounded-md border border-ds-divider">
                          <BigOption
                            label="RAW"
                            title="Keep exact"
                            description="Use entered times"
                            isActive={patternScaleStrategy === "none"}
                            onClick={() => setPatternScaleStrategy("none")}
                            borderBottom
                          />
                          <BigOption
                            label="SCL"
                            title="Scale to target"
                            description="Adjust times to target"
                            isActive={patternScaleStrategy === "fitClosest"}
                            onClick={() => setPatternScaleStrategy("fitClosest")}
                            borderBottom
                          />
                          <BigOption
                            label="REP"
                            title="Repeat to target"
                            description="Repeat list; show delta"
                            isActive={patternScaleStrategy === "multiply"}
                            onClick={() => setPatternScaleStrategy("multiply")}
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-8 flex flex-col gap-5 pt-6 sm:mt-10 sm:gap-6 sm:pt-8">
                      <SetupSubStepTitle notation="1D.">
                        Items and times
                      </SetupSubStepTitle>
                      <PatternScheduleEditor
                        slots={patternSlots}
                        onSlotsChange={setPatternSlots}
                        showDurations
                        showOccurrences={
                          patternConstraint === "cycle" ||
                          patternOccurrenceMode === "perItem"
                        }
                        showScaleDeltas={
                          scheduleMode === "pattern" &&
                          patternConstraint === "fixedLength" &&
                          schedulePreview.ok &&
                          schedulePreview.strategyUsed === "fitClosest"
                        }
                        slotDeltaMs={
                          schedulePreview.ok ? schedulePreview.slotDeltaMs : []
                        }
                      />
                    </div>
                  </>
                ) : null}
              </div>

              {showSessionSection ? (
                <div className="flex w-full min-w-0 flex-col gap-4">
                  <SetupSubStepTitle notation={`${sessionChapterMark}.`}>
                    Session target
                  </SetupSubStepTitle>
                  <div className="flex w-full min-w-0 flex-col overflow-hidden rounded-md border border-ds-divider">
                    {showSessionDuration && (
                      <BigRow
                        label="DUR"
                        borderBottom={showSessionRings}
                        rightAction={
                          setupRemainderNotice ? (
                            <span className="font-mono text-xs tabular-nums text-ds-soft">
                              {setupRemainderNotice}
                            </span>
                          ) : undefined
                        }
                      >
                        <HmsClock
                          phaseLetter="Session"
                          hours={Math.floor(minutes / 60)}
                          minutes={minutes % 60}
                          seconds={secondsPart}
                          onSetHms={(h, m, s) => applySessionDuration(h * 60 + m, s)}
                        />
                      </BigRow>
                    )}
                    {showSessionRings && (
                      <BigRow label="RNG">
                        <BigNumber
                          label="Rings"
                          value={rings}
                          unitLabel="Rings"
                          onChange={setRings}
                        />
                      </BigRow>
                    )}
                  </div>
                </div>
              ) : null}

              {showVariationSection ? (
                <div className="flex w-full min-w-0 flex-col gap-4">
                  <SetupSubStepTitle notation={`${spreadChapterMark}.`}>
                    Variation
                  </SetupSubStepTitle>
                  <div className="mt-1 flex max-w-md flex-col gap-3 border-t border-ds-divider pt-6 lg:mx-0">
                    <VariabilitySlider
                      className="w-full"
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
                </div>
              ) : null}

              {setupScheduleError && (
                <p
                  className="mx-auto max-w-md text-left text-sm leading-snug text-ds-body lg:mx-0"
                  role="alert"
                >
                  {setupScheduleError}
                </p>
              )}

              <div className="flex w-full min-w-0 flex-col gap-4">
                <SetupSubStepTitle notation={`${soundChapterMark}.`}>
                  Sound
                </SetupSubStepTitle>
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
                "lg:border-t-0 lg:pl-0 lg:pt-0",
              ].join(" ")}
            >
              <IntervalSchedulePanel
                intervalsMs={setupIntervals}
                phaseLabels={setupPhaseLabels}
                variant="embedded"
                fillHeight
                headerEnd={
                  <IntervalScheduleTransportBar
                    state="setup"
                    totalMs={
                      schedulePreview.ok
                        ? schedulePreview.intervalsMs.reduce((a, b) => a + b, 0)
                        : 0
                    }
                    elapsedMs={0}
                    startDisabled={!schedulePreview.ok}
                    onStart={beginPlayback}
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
            <div className="mx-auto flex w-full min-w-0 max-w-md flex-col gap-6 sm:max-w-lg lg:mx-0 lg:min-w-0 lg:max-w-none lg:flex-1">
              <div className="flex flex-col gap-5">
                <SetupSubStepTitle notation="1.">While running</SetupSubStepTitle>
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
                "lg:border-t-0 lg:pl-0 lg:pt-0",
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
                  <IntervalScheduleTransportBar
                    state={running ? "running" : "paused"}
                    totalMs={sessionPlanTotalMs}
                    elapsedMs={sessionElapsedPlannedMs}
                    onPause={() => {
                      primeAudioFromUserGesture();
                      pausePlayback();
                      persistTick();
                    }}
                    onResume={() => {
                      primeAudioFromUserGesture();
                      resumePlayback();
                      persistTick();
                    }}
                    onStop={() => {
                      primeAudioFromUserGesture();
                      stopSession();
                    }}
                  />
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
          <p className="font-serif text-[1.65rem] font-light tracking-tight text-ds-fg">
            All rings complete.
          </p>
          <ul className="mx-auto max-h-40 max-w-lg space-y-1 overflow-y-auto px-2 text-center text-sm leading-relaxed text-ds-body">
            {actualSegments.map((ms, i) => (
              <li key={`${i}-${ms}`}>
                Ring {i + 1}
                {completionPhaseLabels?.[i] ? ` · ${completionPhaseLabels[i]}` : ""}:{" "}
                {formatMmSs(ms)}
              </li>
            ))}
          </ul>
          <ControlsRow>
            <ControlButton
              variant="secondary"
              onClick={() => setPhase("setup")}
              aria-label="Back to setup"
            >
              Setup
            </ControlButton>
          </ControlsRow>
        </section>
      )}
    </div>
  );
}
