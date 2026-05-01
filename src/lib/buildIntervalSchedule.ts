/** Minimum duration per ring (matches prior generateIntervals behavior). */
export const MIN_INTERVAL_MS = 5000;

export const MAX_PATTERN_PHASES = 6;

export type BuildScheduleResult =
  | { ok: true; intervalsMs: number[] }
  | { ok: false; error: string };

function sum(a: number[]): number {
  return a.reduce((s, x) => s + x, 0);
}

function multiplierBounds(variability01: number): { minM: number; maxM: number } {
  const v = Math.min(1, Math.max(0, variability01));
  const minM = 1 + v * (0.2 - 1);
  const maxM = 1 + v * (1.8 - 1);
  return { minM, maxM };
}

function randomMultiplier(rng: () => number, minM: number, maxM: number): number {
  return minM + rng() * (maxM - minM);
}

/**
 * Adjusts nonnegative durations to hit exact total while respecting minMs per slot.
 * Same algorithm as the original generateIntervals helper.
 */
export function enforceMinTotal(
  normalized: number[],
  totalMs: number,
  minMs: number
): number[] | null {
  const n = normalized.length;
  let a = normalized.map((v) => Math.max(minMs, v));

  for (let iter = 0; iter < 500; iter++) {
    let s = sum(a);
    if (Math.abs(s - totalMs) < 1e-3) break;
    const diff = totalMs - s;
    if (diff > 0) {
      const addEach = diff / n;
      a = a.map((v) => v + addEach);
      a = a.map((v) => Math.max(minMs, v));
    } else {
      const surplus = -diff;
      const slack = a.map((v) => Math.max(0, v - minMs));
      const slackSum = sum(slack);
      if (slackSum < 1e-9) return null;
      a = a.map((v, i) => v - slack[i] * (surplus / slackSum));
      a = a.map((v) => Math.max(minMs, v));
    }
    s = sum(a);
    if (Math.abs(s - totalMs) < 0.5) break;
  }

  const rounded = a.map((x) => Math.round(x));
  const out = [...rounded];
  let drift = totalMs - sum(out);
  let guard = 0;
  while (drift !== 0 && guard < 1000000) {
    const idx = guard % n;
    if (drift > 0) {
      out[idx] += 1;
      drift -= 1;
    } else if (out[idx] > minMs) {
      out[idx] -= 1;
      drift += 1;
    } else if (Math.max(...out) > minMs) {
      const donor = out.findIndex((v) => v > minMs);
      if (donor >= 0) {
        out[donor] -= 1;
        drift += 1;
      }
    } else return null;
    guard++;
  }
  if (sum(out) !== totalMs || out.some((v) => v < minMs)) return null;
  return out;
}

export function buildRandomSchedule(
  totalDurationMs: number,
  numberOfRings: number,
  variability01: number,
  rng: () => number
): BuildScheduleResult {
  const minMs = MIN_INTERVAL_MS;
  if (!Number.isFinite(totalDurationMs) || totalDurationMs <= 0) {
    return { ok: false, error: "Total duration must be positive." };
  }
  const n = Math.floor(numberOfRings);
  if (n < 1) {
    return { ok: false, error: "Need at least one ring." };
  }
  if (n * minMs > totalDurationMs + 1e-6) {
    return {
      ok: false,
      error: `Total time is too short for ${n} rings (each needs at least 5 seconds).`,
    };
  }

  const base = totalDurationMs / n;
  const { minM, maxM } = multiplierBounds(variability01);
  const weighted: number[] = [];
  for (let i = 0; i < n; i++) {
    weighted.push(base * randomMultiplier(rng, minM, maxM));
  }
  const scale = totalDurationMs / sum(weighted);
  const normalized = weighted.map((x) => x * scale);
  const result = enforceMinTotal(normalized, totalDurationMs, minMs);

  if (!result) {
    return {
      ok: false,
      error: "Could not build a schedule. Try fewer rings or longer duration.",
    };
  }

  return { ok: true, intervalsMs: result };
}

/**
 * Scale a repeating weight pattern across N rings so the sum equals totalMs.
 * weightsMs must have length k ≥ 1 with all entries > 0.
 */
export function buildPatternScheduleFitTotal(
  totalDurationMs: number,
  numberOfRings: number,
  weightsMs: number[]
): BuildScheduleResult {
  const minMs = MIN_INTERVAL_MS;
  if (!Number.isFinite(totalDurationMs) || totalDurationMs <= 0) {
    return { ok: false, error: "Total duration must be positive." };
  }
  const n = Math.floor(numberOfRings);
  if (n < 1) {
    return { ok: false, error: "Need at least one ring." };
  }

  const k = weightsMs.length;
  if (k < 1) {
    return { ok: false, error: "Add at least one phase with a duration." };
  }
  if (k > MAX_PATTERN_PHASES) {
    return { ok: false, error: "Too many phases." };
  }
  if (weightsMs.some((w) => !Number.isFinite(w) || w <= 0)) {
    return { ok: false, error: "Each phase needs a positive duration to scale." };
  }

  if (n * minMs > totalDurationMs + 1e-6) {
    return {
      ok: false,
      error: `Total time is too short for ${n} rings (each needs at least 5 seconds).`,
    };
  }

  let sumW = 0;
  for (let i = 0; i < n; i++) {
    sumW += weightsMs[i % k]!;
  }
  if (sumW <= 0) {
    return { ok: false, error: "Invalid pattern weights." };
  }

  const normalized: number[] = [];
  for (let i = 0; i < n; i++) {
    normalized.push((totalDurationMs * weightsMs[i % k]!) / sumW);
  }

  const result = enforceMinTotal(normalized, totalDurationMs, minMs);
  if (!result) {
    return {
      ok: false,
      error: "Could not build a schedule. Try fewer rings or longer duration.",
    };
  }
  return { ok: true, intervalsMs: result };
}

/** Fixed segment lengths cycling through lengthsMs; each ring must be ≥ minMs. */
export function buildPatternScheduleFixed(
  numberOfRings: number,
  lengthsMs: number[]
): BuildScheduleResult {
  const minMs = MIN_INTERVAL_MS;
  const n = Math.floor(numberOfRings);
  if (n < 1) {
    return { ok: false, error: "Need at least one ring." };
  }
  const k = lengthsMs.length;
  if (k < 1) {
    return { ok: false, error: "Add at least one phase with a duration." };
  }
  if (k > MAX_PATTERN_PHASES) {
    return { ok: false, error: "Too many phases." };
  }

  const intervalsMs: number[] = [];
  for (let i = 0; i < n; i++) {
    const ms = Math.round(lengthsMs[i % k]!);
    if (!Number.isFinite(ms) || ms < minMs) {
      return {
        ok: false,
        error: `Each ring must be at least 5 seconds (phase ${String.fromCharCode(65 + (i % k))}).`,
      };
    }
    intervalsMs.push(ms);
  }
  return { ok: true, intervalsMs };
}

/** Label for ring index i when cycling k phases A… */
export function phaseLetterForRing(i: number, k: number): string {
  const kk = Math.max(1, Math.min(MAX_PATTERN_PHASES, k));
  return String.fromCharCode(65 + (i % kk));
}

export function phaseLabelsForSchedule(rings: number, k: number): string[] {
  return Array.from({ length: rings }, (_, i) => phaseLetterForRing(i, k));
}

/** Deterministic 32-bit mixer for PRNG seeding. */
export function mixSeed(parts: number[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    const x = Math.floor(p) | 0;
    h ^= x;
    h = Math.imul(h, 0x01000193);
    h >>>= 0;
  }
  return h >>> 0;
}

/** Mulberry32 PRNG; returns values in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
