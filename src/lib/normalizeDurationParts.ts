const MAX_MINUTES = 999;
/** Longest representable session: 999m 59s — also caps single pattern phase weight. */
export const MAX_DURATION_TOTAL_SEC = MAX_MINUTES * 60 + 59;

/** Largest whole-hour count that fits in {@link MAX_DURATION_TOTAL_SEC}. */
export const MAX_HOURS_FOR_PHASE = Math.floor(MAX_DURATION_TOTAL_SEC / 3600);

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

/** Clamp total seconds and split toHours / minutes / seconds. */
export function splitTotalSecToHms(totalSecRaw: number): {
  hours: number;
  minutes: number;
  secondsPart: number;
} {
  let totalSec = Math.trunc(Number.isFinite(totalSecRaw) ? totalSecRaw : 0);
  if (totalSec < 0) totalSec = 0;
  if (totalSec > MAX_DURATION_TOTAL_SEC) totalSec = MAX_DURATION_TOTAL_SEC;
  return {
    hours: Math.floor(totalSec / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    secondsPart: totalSec % 60,
  };
}

/** Fold hour/minute/second overflow and clamp to max duration (for pattern phases). */
export function normalizeHmsParts(
  hours: number,
  minutes: number,
  secondsPart: number
): { hours: number; minutes: number; secondsPart: number } {
  const h = Number.isFinite(hours) ? Math.trunc(hours) : 0;
  const m = Number.isFinite(minutes) ? Math.trunc(minutes) : 0;
  const s = Number.isFinite(secondsPart) ? Math.trunc(secondsPart) : 0;
  return splitTotalSecToHms(h * 3600 + m * 60 + s);
}

export function totalMsFromNormalizedParts(minutes: number, secondsPart: number): number {
  const { minutes: mm, secondsPart: ss } = normalizeDurationParts(minutes, secondsPart);
  return mm * 60_000 + ss * 1000;
}

export function totalMsFromHms(hours: number, minutes: number, secondsPart: number): number {
  const p = normalizeHmsParts(hours, minutes, secondsPart);
  return (p.hours * 3600 + p.minutes * 60 + p.secondsPart) * 1000;
}

export function totalSecFromHms(hours: number, minutes: number, secondsPart: number): number {
  const p = normalizeHmsParts(hours, minutes, secondsPart);
  return p.hours * 3600 + p.minutes * 60 + p.secondsPart;
}
