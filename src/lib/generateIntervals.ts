import { buildRandomSchedule, type BuildScheduleResult } from "./buildIntervalSchedule";

export type GenerateIntervalsResult = BuildScheduleResult;

/**
 * Split total duration into N variable-length rings (legacy entry point).
 * Prefer {@link buildRandomSchedule} with an explicit RNG when preview must match playback.
 */
export function generateIntervals(
  totalDurationMs: number,
  numberOfRings: number,
  variability01: number,
  rng: () => number = Math.random
): GenerateIntervalsResult {
  return buildRandomSchedule(totalDurationMs, numberOfRings, variability01, rng);
}

export { MIN_INTERVAL_MS } from "./buildIntervalSchedule";
