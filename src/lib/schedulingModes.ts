import { MIN_INTERVAL_MS, enforceMinTotal } from "@/lib/buildIntervalSchedule";

export type SchedulingMode =
  | "KeepExact"
  | "UseEnterTimes"
  | "ScaleToFit"
  | "RepeatToFill"
  | "PickEachTime";

export type ConcreteSchedulingMode = Exclude<SchedulingMode, "PickEachTime">;

export type RepeatOvershootPolicy = "closest" | "noOvershoot";

export type SchedulingRequest = {
  mode: SchedulingMode;
  /** Input interval values in minutes. */
  inputTimesMinutes: number[];
  /** Target duration in minutes (required for all modes except KeepExact). */
  targetDurationMinutes?: number;
  /** Required only when mode = PickEachTime. */
  pickMode?: ConcreteSchedulingMode;
  /** Optional minimum interval length in minutes. Defaults to 5 seconds. */
  minIntervalMinutes?: number;
  /** RepeatToFill selection rule. Defaults to "closest". */
  overshootPolicy?: RepeatOvershootPolicy;
};

export type SchedulingResult = {
  modeApplied: ConcreteSchedulingMode;
  intervalsMs: number[];
  intervalsMinutes: number[];
  cycleDurationMs: number;
  derivedCycles: number;
  scaleFactor: number;
  totalDurationMs: number;
  totalDurationMinutes: number;
  targetDurationMs: number | null;
  targetDurationMinutes: number | null;
  /** target - actual. Positive = left over, negative = overage. */
  deltaMs: number;
  leftoverMs: number;
  overageMs: number;
  /** Scaling uses largest-remainder-style integer-ms correction via enforceMinTotal. */
  roundingStrategy: "largest-remainder-ms";
};

export type SchedulingResponse =
  | { ok: true; result: SchedulingResult }
  | { ok: false; error: string };

export function buildSchedule(request: SchedulingRequest): SchedulingResponse {
  const mode: ConcreteSchedulingMode =
    request.mode === "PickEachTime"
      ? request.pickMode ?? "KeepExact"
      : request.mode;

  if (request.mode === "PickEachTime" && !request.pickMode) {
    return {
      ok: false,
      error: "PickEachTime requires pickMode to be provided.",
    };
  }

  const minIntervalMs = normalizeMinIntervalMs(request.minIntervalMinutes);

  const normalized = normalizeInputMinutesToMs(request.inputTimesMinutes, minIntervalMs);
  if (!normalized.ok) return normalized;

  const inputMs = normalized.intervalsMs;
  const cycleDurationMs = sum(inputMs);

  const targetMsRes = normalizeOptionalTargetMinutesToMs(request.targetDurationMinutes);
  if (!targetMsRes.ok) return targetMsRes;
  const targetMs = targetMsRes.targetMs;

  switch (mode) {
    case "KeepExact":
      return {
        ok: true,
        result: finalizeResult({
          modeApplied: "KeepExact",
          intervalsMs: inputMs,
          cycleDurationMs,
          derivedCycles: 1,
          scaleFactor: 1,
          targetDurationMs: targetMs,
        }),
      };

    case "UseEnterTimes": {
      if (targetMs == null) {
        return {
          ok: false,
          error: "targetDurationMinutes is required for UseEnterTimes.",
        };
      }
      return buildUseEnterTimes(inputMs, cycleDurationMs, targetMs, minIntervalMs);
    }

    case "ScaleToFit": {
      if (targetMs == null) {
        return {
          ok: false,
          error: "targetDurationMinutes is required for ScaleToFit.",
        };
      }
      return buildScaleToFit(inputMs, cycleDurationMs, targetMs, minIntervalMs);
    }

    case "RepeatToFill": {
      if (targetMs == null) {
        return {
          ok: false,
          error: "targetDurationMinutes is required for RepeatToFill.",
        };
      }
      return buildRepeatToFill(
        inputMs,
        cycleDurationMs,
        targetMs,
        request.overshootPolicy ?? "closest"
      );
    }

    default:
      return {
        ok: false,
        error: "Unsupported scheduling mode.",
      };
  }
}

function buildUseEnterTimes(
  inputMs: number[],
  cycleDurationMs: number,
  targetMs: number,
  minIntervalMs: number
): SchedulingResponse {
  if (targetMs <= 0) {
    return { ok: false, error: "Target duration must be greater than 0." };
  }

  if (targetMs < inputMs.length * minIntervalMs) {
    return {
      ok: false,
      error: "Target is shorter than the minimum required time for these intervals.",
    };
  }

  const scaleFactor = targetMs / cycleDurationMs;
  const idealScaled = inputMs.map((ms) => ms * scaleFactor);
  const fitted = enforceMinTotal(idealScaled, targetMs, minIntervalMs);

  if (!fitted) {
    return {
      ok: false,
      error: "Could not scale intervals to target with current minimum interval constraint.",
    };
  }

  return {
    ok: true,
    result: finalizeResult({
      modeApplied: "UseEnterTimes",
      intervalsMs: fitted,
      cycleDurationMs,
      derivedCycles: 1,
      scaleFactor,
      targetDurationMs: targetMs,
    }),
  };
}

type ScaleCandidate = {
  intervalsMs: number[];
  cycles: number;
  scaleFactor: number;
  fitError: number;
  scaleDeviation: number;
  roundingDistortion: number;
};

function buildScaleToFit(
  inputMs: number[],
  cycleDurationMs: number,
  targetMs: number,
  minIntervalMs: number
): SchedulingResponse {
  if (targetMs <= 0) {
    return { ok: false, error: "Target duration must be greater than 0." };
  }

  const oneCycleCount = inputMs.length;
  const maxIntervals = Math.floor(targetMs / minIntervalMs);
  const maxCycles = Math.floor(maxIntervals / oneCycleCount);

  if (maxCycles < 1) {
    return {
      ok: false,
      error: "Target is shorter than the minimum required time for one cycle.",
    };
  }

  let best: ScaleCandidate | null = null;

  for (let cycles = 1; cycles <= maxCycles; cycles++) {
    const repeated = repeatArray(inputMs, cycles);
    const repeatedTotal = sum(repeated);
    if (repeatedTotal <= 0) continue;

    const scaleFactor = targetMs / repeatedTotal;
    const ideal = repeated.map((ms) => ms * scaleFactor);
    const fitted = enforceMinTotal(ideal, targetMs, minIntervalMs);
    if (!fitted) continue;

    const actualTotal = sum(fitted);
    const fitError = Math.abs(targetMs - actualTotal);
    const scaleDeviation = Math.abs(1 - scaleFactor);
    const roundingDistortion = sum(
      fitted.map((ms, i) => Math.abs(ms - (ideal[i] ?? ms)))
    );

    const candidate: ScaleCandidate = {
      intervalsMs: fitted,
      cycles,
      scaleFactor,
      fitError,
      scaleDeviation,
      roundingDistortion,
    };

    if (!best || isBetterScaleCandidate(candidate, best)) {
      best = candidate;
    }
  }

  if (!best) {
    return {
      ok: false,
      error: "Could not derive a scaled schedule for the given target and constraints.",
    };
  }

  return {
    ok: true,
    result: finalizeResult({
      modeApplied: "ScaleToFit",
      intervalsMs: best.intervalsMs,
      cycleDurationMs,
      derivedCycles: best.cycles,
      scaleFactor: best.scaleFactor,
      targetDurationMs: targetMs,
    }),
  };
}

function isBetterScaleCandidate(a: ScaleCandidate, b: ScaleCandidate): boolean {
  if (a.fitError !== b.fitError) return a.fitError < b.fitError;
  if (a.scaleDeviation !== b.scaleDeviation) return a.scaleDeviation < b.scaleDeviation;
  if (a.roundingDistortion !== b.roundingDistortion) {
    return a.roundingDistortion < b.roundingDistortion;
  }
  return a.intervalsMs.length < b.intervalsMs.length;
}

function buildRepeatToFill(
  inputMs: number[],
  cycleDurationMs: number,
  targetMs: number,
  policy: RepeatOvershootPolicy
): SchedulingResponse {
  if (targetMs < 0) {
    return { ok: false, error: "Target duration cannot be negative." };
  }

  if (targetMs === 0) {
    return {
      ok: true,
      result: finalizeResult({
        modeApplied: "RepeatToFill",
        intervalsMs: [],
        cycleDurationMs,
        derivedCycles: 0,
        scaleFactor: 1,
        targetDurationMs: targetMs,
      }),
    };
  }

  const floorCycles = Math.floor(targetMs / cycleDurationMs);
  const ceilCycles = floorCycles + 1;

  const floorTotal = floorCycles * cycleDurationMs;
  const ceilTotal = ceilCycles * cycleDurationMs;

  let cycles = floorCycles;
  if (policy === "closest") {
    const floorDiff = Math.abs(targetMs - floorTotal);
    const ceilDiff = Math.abs(targetMs - ceilTotal);
    cycles = ceilDiff < floorDiff ? ceilCycles : floorCycles;
  }

  const intervalsMs = repeatArray(inputMs, cycles);

  return {
    ok: true,
    result: finalizeResult({
      modeApplied: "RepeatToFill",
      intervalsMs,
      cycleDurationMs,
      derivedCycles: cycles,
      scaleFactor: 1,
      targetDurationMs: targetMs,
    }),
  };
}

function finalizeResult(args: {
  modeApplied: ConcreteSchedulingMode;
  intervalsMs: number[];
  cycleDurationMs: number;
  derivedCycles: number;
  scaleFactor: number;
  targetDurationMs: number | null;
}): SchedulingResult {
  const totalDurationMs = sum(args.intervalsMs);
  const targetDurationMs = args.targetDurationMs;
  const deltaMs = targetDurationMs == null ? 0 : targetDurationMs - totalDurationMs;

  return {
    modeApplied: args.modeApplied,
    intervalsMs: args.intervalsMs,
    intervalsMinutes: args.intervalsMs.map((ms) => ms / 60_000),
    cycleDurationMs: args.cycleDurationMs,
    derivedCycles: args.derivedCycles,
    scaleFactor: args.scaleFactor,
    totalDurationMs,
    totalDurationMinutes: totalDurationMs / 60_000,
    targetDurationMs,
    targetDurationMinutes:
      targetDurationMs == null ? null : targetDurationMs / 60_000,
    deltaMs,
    leftoverMs: Math.max(0, deltaMs),
    overageMs: Math.max(0, -deltaMs),
    roundingStrategy: "largest-remainder-ms",
  };
}

function normalizeInputMinutesToMs(
  inputTimesMinutes: number[],
  minIntervalMs: number
): { ok: true; intervalsMs: number[] } | { ok: false; error: string } {
  if (!Array.isArray(inputTimesMinutes) || inputTimesMinutes.length === 0) {
    return { ok: false, error: "inputTimesMinutes must contain at least one value." };
  }

  const intervalsMs: number[] = [];
  for (const minutes of inputTimesMinutes) {
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return {
        ok: false,
        error: "Each input time must be a finite number greater than 0.",
      };
    }
    const ms = Math.round(minutes * 60_000);
    if (ms < minIntervalMs) {
      return {
        ok: false,
        error: "An input time is shorter than the minimum allowed interval.",
      };
    }
    intervalsMs.push(ms);
  }

  return { ok: true, intervalsMs };
}

function normalizeOptionalTargetMinutesToMs(
  targetDurationMinutes?: number
): { ok: true; targetMs: number | null } | { ok: false; error: string } {
  if (targetDurationMinutes == null) return { ok: true, targetMs: null };

  if (!Number.isFinite(targetDurationMinutes) || targetDurationMinutes < 0) {
    return {
      ok: false,
      error: "targetDurationMinutes must be a finite number greater than or equal to 0.",
    };
  }

  return { ok: true, targetMs: Math.round(targetDurationMinutes * 60_000) };
}

function normalizeMinIntervalMs(minIntervalMinutes?: number): number {
  if (minIntervalMinutes == null) return MIN_INTERVAL_MS;
  if (!Number.isFinite(minIntervalMinutes) || minIntervalMinutes <= 0) {
    return MIN_INTERVAL_MS;
  }
  return Math.max(1, Math.round(minIntervalMinutes * 60_000));
}

function repeatArray(values: number[], cycles: number): number[] {
  if (cycles <= 0) return [];
  const out: number[] = [];
  for (let c = 0; c < cycles; c++) {
    out.push(...values);
  }
  return out;
}

function sum(values: number[]): number {
  return values.reduce((acc, n) => acc + n, 0);
}
