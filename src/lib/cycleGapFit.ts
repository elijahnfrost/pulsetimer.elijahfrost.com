export type CycleGapFitResult = {
  /** Number of full repetitions of the durations array that fit in the gap. */
  completeCycles: number;
  /** Sum of one full repetition of the durations array. */
  cycleDuration: number;
  /** Total time consumed by the fitted full cycles. */
  totalTimeUsed: number;
  /** Unfilled time after all complete cycles are placed. */
  leftoverTime: number;
};

export type CycleGapFitResponse =
  | { ok: true; result: CycleGapFitResult }
  | { ok: false; error: string };

/**
 * Fits complete repetitions of `durations` into `gapDuration`.
 *
 * Units are caller-defined (minutes, seconds, etc.) as long as both inputs use the same unit.
 *
 * Example:
 * - gapDuration: 45, durations: [4] => 11 cycles, 44 used, 1 leftover
 * - gapDuration: 45, durations: [5, 2] => 6 cycles, 42 used, 3 leftover
 */
export function fitCompleteCyclesInGap(
  gapDuration: number,
  durations: number[]
): CycleGapFitResponse {
  if (!Number.isFinite(gapDuration)) {
    return { ok: false, error: "gap_duration must be a finite number." };
  }

  if (!Array.isArray(durations) || durations.length === 0) {
    return { ok: false, error: "durations must contain at least one value." };
  }

  if (durations.some((d) => !Number.isFinite(d) || d <= 0)) {
    return {
      ok: false,
      error: "Each duration must be a finite number greater than 0.",
    };
  }

  const safeGap = Math.max(0, gapDuration);
  const cycleDuration = durations.reduce((sum, d) => sum + d, 0);

  if (cycleDuration <= 0) {
    return { ok: false, error: "Total cycle duration must be greater than 0." };
  }

  const completeCycles = Math.floor(safeGap / cycleDuration);
  const totalTimeUsed = completeCycles * cycleDuration;

  const rawLeftover = safeGap - totalTimeUsed;
  const leftoverTime = Math.abs(rawLeftover) < 1e-9 ? 0 : rawLeftover;

  return {
    ok: true,
    result: {
      completeCycles,
      cycleDuration,
      totalTimeUsed,
      leftoverTime,
    },
  };
}
