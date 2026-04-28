const MAX_MINUTES = 999;
/** Longest representable session: 999m 59s */
export const MAX_DURATION_TOTAL_SEC = MAX_MINUTES * 60 + 59;

/**
 * Collapse seconds into minutes (e.g. 120s → 2m 0s) and cap at max duration.
 */
export function normalizeDurationParts(
  minutes: number,
  secondsPart: number
): { minutes: number; secondsPart: number } {
  const m = Number.isFinite(minutes) ? Math.trunc(minutes) : 0;
  const s = Number.isFinite(secondsPart) ? Math.trunc(secondsPart) : 0;
  let totalSec = m * 60 + s;
  if (totalSec < 0) totalSec = 0;
  if (totalSec > MAX_DURATION_TOTAL_SEC) totalSec = MAX_DURATION_TOTAL_SEC;
  return {
    minutes: Math.floor(totalSec / 60),
    secondsPart: totalSec % 60,
  };
}

export function totalMsFromNormalizedParts(minutes: number, secondsPart: number): number {
  const { minutes: mm, secondsPart: ss } = normalizeDurationParts(minutes, secondsPart);
  return mm * 60_000 + ss * 1000;
}
