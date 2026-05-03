export type CycleFitResult =
  | {
      ok: true;
      completeCycles: number;
      totalTimeUsed: number;
      leftoverTime: number;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Calculates how many complete repetitions of `durations` fit into `gapDuration`.
 * Units are minutes for both inputs and outputs.
 */
export function fitCompleteCycles(
  gapDuration: number,
  durations: number[]
): CycleFitResult {
  if (!Number.isFinite(gapDuration) || gapDuration < 0) {
    return { ok: false, error: "gapDuration must be a non-negative number." };
  }

  if (!Array.isArray(durations) || durations.length === 0) {
    return { ok: false, error: "durations must be a non-empty array." };
  }

  if (durations.some((d) => !Number.isFinite(d) || d <= 0)) {
    return { ok: false, error: "Each duration must be a positive number." };
  }

  const cycleDuration = durations.reduce((sum, d) => sum + d, 0);
  if (!Number.isFinite(cycleDuration) || cycleDuration <= 0) {
    return { ok: false, error: "Total cycle duration must be positive." };
  }

  const completeCycles = Math.floor(gapDuration / cycleDuration);
  const totalTimeUsed = completeCycles * cycleDuration;

  // Normalize tiny floating-point artifacts (e.g. 0.30000000000000004)
  const rawLeftover = gapDuration - totalTimeUsed;
  const leftoverTime = Math.abs(rawLeftover) < 1e-9 ? 0 : rawLeftover;

  return {
    ok: true,
    completeCycles,
    totalTimeUsed,
    leftoverTime,
  };
}
