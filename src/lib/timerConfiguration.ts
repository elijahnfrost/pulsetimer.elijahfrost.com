import { MIN_INTERVAL_MS, enforceMinTotal } from "@/lib/buildIntervalSchedule";

export type TimerMode = "fixedTarget" | "multiply" | "scaling";

export type ActivityDefinition = {
  /** Stable ID used by sequence entries. */
  id: string;
  /** Human-readable label shown in schedule rows. */
  label: string;
  /** Planned count for this activity. */
  count: number;
  /** Default per-instance duration (ms) for this activity. */
  defaultDurationMs: number;
};

export type SequenceItem = {
  /** Activity ID to place at this point in the sequence. */
  activityId: string;
  /** Optional per-instance duration override (ms). */
  durationMs?: number;
};

export type TimerConfiguration = {
  /** Activity catalog + planned counts. */
  activities: ActivityDefinition[];
  /**
   * Exact order of instances. If omitted, a default even distribution is generated.
   * When present, order is honored exactly as supplied.
   */
  sequence?: SequenceItem[];
  /**
   * Scheduling mode:
   * - fixedTarget: keep configured durations/order exactly; report delta to target.
   * - multiply: repeat base sequence to approach target; report remainder/overage.
   * - scaling: proportionally scale each instance duration to hit target exactly.
   */
  mode: TimerMode;
  /** Optional target total duration (ms). Required for multiply + scaling. */
  targetDurationMs?: number;
  /**
   * If true, sequence usage count for each activity must match `activities.count`.
   * Defaults to true.
   */
  strictCountMatching?: boolean;
  /** Minimum duration per instance in ms. Defaults to 5 seconds. */
  minStepMs?: number;
};

export type ResolvedSequenceStep = {
  /** Index in final execution order. */
  index: number;
  activityId: string;
  activityLabel: string;
  /** 1-based occurrence number of the activity inside one base sequence. */
  activityOccurrence: number;
  /** 1-based sequence loop number (1 for fixed/scaled, N for multiply). */
  sequenceLoop: number;
  durationMs: number;
};

export type TimerExecutionPlan = {
  mode: TimerMode;
  steps: ResolvedSequenceStep[];
  totalDurationMs: number;
  targetDurationMs: number | null;
  /** Positive: time left. Negative: over target. */
  deltaToTargetMs: number;
  /** 1 for non-multiply modes, otherwise number of base-sequence repeats. */
  loops: number;
  /** Number of steps in the base (unmultiplied) sequence. */
  baseStepCount: number;
};

export type BuildTimerPlanResult =
  | { ok: true; plan: TimerExecutionPlan }
  | { ok: false; error: string };

export type TimerExecutionState = {
  stepIndex: number;
  stepElapsedMs: number;
  totalElapsedMs: number;
  complete: boolean;
};

export function buildDefaultEvenSequence(activities: ActivityDefinition[]): SequenceItem[] {
  const counts = activities.map((a) => normalizeCount(a.count));
  const out: SequenceItem[] = [];

  let remaining = counts.reduce((s, n) => s + n, 0);
  while (remaining > 0) {
    for (let i = 0; i < activities.length; i++) {
      if ((counts[i] ?? 0) > 0) {
        out.push({ activityId: activities[i]!.id });
        counts[i] = (counts[i] ?? 0) - 1;
        remaining -= 1;
      }
    }
  }

  return out;
}

export function buildTimerPlan(config: TimerConfiguration): BuildTimerPlanResult {
  const minStepMs = normalizeMinStepMs(config.minStepMs ?? MIN_INTERVAL_MS);

  const prep = prepareBaseSequence(config, minStepMs);
  if (!prep.ok) return prep;

  const baseSteps = prep.baseSteps;
  const baseTotal = sum(baseSteps.map((s) => s.durationMs));
  const target =
    typeof config.targetDurationMs === "number"
      ? Math.max(0, Math.round(config.targetDurationMs))
      : null;

  if (config.mode === "fixedTarget") {
    const steps = withIndexAndLoop(baseSteps, 1);
    const total = sum(steps.map((s) => s.durationMs));
    return {
      ok: true,
      plan: {
        mode: "fixedTarget",
        steps,
        totalDurationMs: total,
        targetDurationMs: target,
        deltaToTargetMs: target == null ? 0 : target - total,
        loops: 1,
        baseStepCount: baseSteps.length,
      },
    };
  }

  if (target == null || target <= 0) {
    return {
      ok: false,
      error: "Target duration must be provided for multiply and scaling modes.",
    };
  }

  if (config.mode === "multiply") {
    if (baseTotal <= 0) {
      return { ok: false, error: "Base sequence duration must be positive." };
    }

    const loops = Math.max(1, Math.round(target / baseTotal));
    const multiplied = multiplySteps(baseSteps, loops);
    const total = sum(multiplied.map((s) => s.durationMs));

    return {
      ok: true,
      plan: {
        mode: "multiply",
        steps: multiplied,
        totalDurationMs: total,
        targetDurationMs: target,
        deltaToTargetMs: target - total,
        loops,
        baseStepCount: baseSteps.length,
      },
    };
  }

  // scaling mode
  const scaled = scaleStepsToTarget(baseSteps, target, minStepMs);
  if (!scaled.ok) return scaled;

  const scaledTotal = sum(scaled.steps.map((s) => s.durationMs));
  return {
    ok: true,
    plan: {
      mode: "scaling",
      steps: withIndexAndLoop(scaled.steps, 1),
      totalDurationMs: scaledTotal,
      targetDurationMs: target,
      deltaToTargetMs: target - scaledTotal,
      loops: 1,
      baseStepCount: baseSteps.length,
    },
  };
}

export function initialExecutionState(): TimerExecutionState {
  return {
    stepIndex: 0,
    stepElapsedMs: 0,
    totalElapsedMs: 0,
    complete: false,
  };
}

/**
 * Advance execution by a wall-clock delta in milliseconds.
 * This reducer is pure and can run inside any timer loop.
 */
export function advanceExecution(
  plan: TimerExecutionPlan,
  prev: TimerExecutionState,
  deltaMsRaw: number
): TimerExecutionState {
  if (prev.complete || plan.steps.length === 0) return { ...prev, complete: true };

  let deltaMs = Math.max(0, Math.round(deltaMsRaw));
  let stepIndex = Math.max(0, Math.min(prev.stepIndex, plan.steps.length - 1));
  let stepElapsedMs = Math.max(0, Math.round(prev.stepElapsedMs));
  let totalElapsedMs = Math.max(0, Math.round(prev.totalElapsedMs));

  while (deltaMs > 0 && stepIndex < plan.steps.length) {
    const step = plan.steps[stepIndex]!;
    const remainingInStep = Math.max(0, step.durationMs - stepElapsedMs);

    if (remainingInStep === 0) {
      stepIndex += 1;
      stepElapsedMs = 0;
      continue;
    }

    const consume = Math.min(deltaMs, remainingInStep);
    deltaMs -= consume;
    stepElapsedMs += consume;
    totalElapsedMs += consume;

    if (stepElapsedMs >= step.durationMs) {
      stepIndex += 1;
      stepElapsedMs = 0;
    }
  }

  const complete = stepIndex >= plan.steps.length;

  return {
    stepIndex: complete ? plan.steps.length - 1 : stepIndex,
    stepElapsedMs: complete ? plan.steps[plan.steps.length - 1]!.durationMs : stepElapsedMs,
    totalElapsedMs,
    complete,
  };
}

export function getExecutionSnapshot(plan: TimerExecutionPlan, state: TimerExecutionState): {
  currentStep: ResolvedSequenceStep | null;
  currentStepRemainingMs: number;
  totalRemainingMs: number;
  complete: boolean;
} {
  if (plan.steps.length === 0 || state.complete) {
    return {
      currentStep: null,
      currentStepRemainingMs: 0,
      totalRemainingMs: 0,
      complete: true,
    };
  }

  const safeIdx = Math.max(0, Math.min(state.stepIndex, plan.steps.length - 1));
  const currentStep = plan.steps[safeIdx]!;
  const currentStepRemainingMs = Math.max(0, currentStep.durationMs - state.stepElapsedMs);

  let tail = currentStepRemainingMs;
  for (let i = safeIdx + 1; i < plan.steps.length; i++) {
    tail += plan.steps[i]!.durationMs;
  }

  return {
    currentStep,
    currentStepRemainingMs,
    totalRemainingMs: tail,
    complete: false,
  };
}

export function planToIntervals(plan: TimerExecutionPlan): {
  intervalsMs: number[];
  activityLabels: string[];
} {
  return {
    intervalsMs: plan.steps.map((s) => s.durationMs),
    activityLabels: plan.steps.map((s) => s.activityLabel),
  };
}

type PreparedBaseResult =
  | { ok: true; baseSteps: Omit<ResolvedSequenceStep, "index" | "sequenceLoop">[] }
  | { ok: false; error: string };

function prepareBaseSequence(
  config: TimerConfiguration,
  minStepMs: number
): PreparedBaseResult {
  const activities = config.activities;
  if (!Array.isArray(activities) || activities.length < 1) {
    return { ok: false, error: "Add at least one activity." };
  }

  const seenIds = new Set<string>();
  const activityById = new Map<string, ActivityDefinition>();
  for (const activity of activities) {
    if (!activity?.id || typeof activity.id !== "string") {
      return { ok: false, error: "Each activity must have a valid id." };
    }
    if (seenIds.has(activity.id)) {
      return { ok: false, error: `Duplicate activity id: ${activity.id}` };
    }
    seenIds.add(activity.id);

    const count = normalizeCount(activity.count);
    if (count < 0) {
      return { ok: false, error: `Invalid count for activity ${activity.label}.` };
    }

    const baseMs = Math.round(activity.defaultDurationMs);
    if (!Number.isFinite(baseMs) || baseMs < minStepMs) {
      return {
        ok: false,
        error: `Default duration for ${activity.label} must be at least ${Math.ceil(minStepMs / 1000)} seconds.`,
      };
    }

    activityById.set(activity.id, {
      ...activity,
      count,
      defaultDurationMs: baseMs,
    });
  }

  const sequence =
    config.sequence && config.sequence.length > 0
      ? config.sequence
      : buildDefaultEvenSequence(activities);

  if (!Array.isArray(sequence) || sequence.length < 1) {
    return { ok: false, error: "Sequence is empty." };
  }

  const strictCountMatching = config.strictCountMatching ?? true;
  const usedCount = new Map<string, number>();
  const occurrenceCounter = new Map<string, number>();
  const baseSteps: Omit<ResolvedSequenceStep, "index" | "sequenceLoop">[] = [];

  for (const item of sequence) {
    if (!item?.activityId || typeof item.activityId !== "string") {
      return { ok: false, error: "Each sequence item needs a valid activityId." };
    }

    const activity = activityById.get(item.activityId);
    if (!activity) {
      return { ok: false, error: `Sequence references unknown activity id: ${item.activityId}` };
    }

    const priorUsed = usedCount.get(activity.id) ?? 0;
    usedCount.set(activity.id, priorUsed + 1);

    const priorOccurrence = occurrenceCounter.get(activity.id) ?? 0;
    const activityOccurrence = priorOccurrence + 1;
    occurrenceCounter.set(activity.id, activityOccurrence);

    const resolvedMs =
      typeof item.durationMs === "number"
        ? Math.round(item.durationMs)
        : activity.defaultDurationMs;

    if (!Number.isFinite(resolvedMs) || resolvedMs < minStepMs) {
      return {
        ok: false,
        error: `Duration for ${activity.label} occurrence ${activityOccurrence} must be at least ${Math.ceil(minStepMs / 1000)} seconds.`,
      };
    }

    baseSteps.push({
      activityId: activity.id,
      activityLabel: activity.label,
      activityOccurrence,
      durationMs: resolvedMs,
    });
  }

  if (strictCountMatching) {
    for (const activity of activities) {
      const expected = normalizeCount(activity.count);
      const actual = usedCount.get(activity.id) ?? 0;
      if (expected !== actual) {
        return {
          ok: false,
          error: `Activity ${activity.label} expected ${expected} occurrence(s), got ${actual}.`,
        };
      }
    }
  }

  return { ok: true, baseSteps };
}

function scaleStepsToTarget(
  baseSteps: Omit<ResolvedSequenceStep, "index" | "sequenceLoop">[],
  targetMs: number,
  minStepMs: number
):
  | { ok: true; steps: Omit<ResolvedSequenceStep, "index" | "sequenceLoop">[] }
  | { ok: false; error: string } {
  if (baseSteps.length < 1) {
    return { ok: false, error: "Need at least one step to scale." };
  }
  if (targetMs < baseSteps.length * minStepMs) {
    return {
      ok: false,
      error: `Target is too short for ${baseSteps.length} step(s) at minimum ${Math.ceil(minStepMs / 1000)}s each.`,
    };
  }

  const source = baseSteps.map((s) => s.durationMs);
  const scaled = enforceMinTotal(source, targetMs, minStepMs);
  if (!scaled) {
    return {
      ok: false,
      error: "Could not scale sequence to target. Try longer target or fewer steps.",
    };
  }

  return {
    ok: true,
    steps: baseSteps.map((s, i) => ({
      ...s,
      durationMs: scaled[i] ?? s.durationMs,
    })),
  };
}

function multiplySteps(
  baseSteps: Omit<ResolvedSequenceStep, "index" | "sequenceLoop">[],
  loops: number
): ResolvedSequenceStep[] {
  const out: ResolvedSequenceStep[] = [];
  let idx = 0;
  for (let loop = 1; loop <= loops; loop++) {
    for (const step of baseSteps) {
      out.push({
        index: idx,
        sequenceLoop: loop,
        ...step,
      });
      idx += 1;
    }
  }
  return out;
}

function withIndexAndLoop(
  steps: Omit<ResolvedSequenceStep, "index" | "sequenceLoop">[],
  loop: number
): ResolvedSequenceStep[] {
  return steps.map((s, i) => ({
    ...s,
    index: i,
    sequenceLoop: loop,
  }));
}

function normalizeCount(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}

function normalizeMinStepMs(raw: number): number {
  if (!Number.isFinite(raw)) return MIN_INTERVAL_MS;
  return Math.max(1, Math.round(raw));
}

function sum(values: number[]): number {
  return values.reduce((s, n) => s + n, 0);
}
