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

function clampTotalSecRaw(sec: number): number {
  let t = Math.trunc(Number.isFinite(sec) ? sec : 0);
  if (t < 0) t = 0;
  if (t > MAX_DURATION_TOTAL_SEC) t = MAX_DURATION_TOTAL_SEC;
  return t;
}

/**
 * Parse a single free-form duration string into total seconds (clamped).
 *
 * Supported shapes:
 * - Bare integer → seconds (e.g. `100` → 1m 40s).
 * - `H:MM:SS` or `M:SS` (values may overflow; result is normalized/clamped).
 * - Unit suffixes on a compact string (e.g. `120m`, `2h30m`, `1h2m3s`, `90s`).
 */
export function parseDurationInputToTotalSec(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const compact = trimmed.replace(/\s+/g, "").toLowerCase();

  if (/^\d+$/.test(compact)) {
    return clampTotalSecRaw(parseInt(compact, 10));
  }

  const colonParts = trimmed.split(":").map((p) => p.trim());
  if (colonParts.length === 2 && colonParts.every((p) => /^\d+$/.test(p))) {
    const minutesPart = parseInt(colonParts[0], 10);
    const secondsPart = parseInt(colonParts[1], 10);
    return clampTotalSecRaw(minutesPart * 60 + secondsPart);
  }
  if (colonParts.length === 3 && colonParts.every((p) => /^\d+$/.test(p))) {
    const h = parseInt(colonParts[0], 10);
    const m = parseInt(colonParts[1], 10);
    const s = parseInt(colonParts[2], 10);
    return clampTotalSecRaw(h * 3600 + m * 60 + s);
  }

  const unitSegment =
    /^(\d+)(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)/;
  let remaining = compact;
  let total = 0;
  let matchedAny = false;
  while (remaining.length > 0) {
    const m = remaining.match(unitSegment);
    if (!m) return null;
    matchedAny = true;
    const n = parseInt(m[1], 10);
    const u = m[2];
    if (u.startsWith("h")) total += n * 3600;
    else if (u.startsWith("m")) total += n * 60;
    else total += n;
    remaining = remaining.slice(m[0].length);
  }

  return matchedAny ? clampTotalSecRaw(total) : null;
}
