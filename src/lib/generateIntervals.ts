const MIN_INTERVAL_MS = 5000;

export type GenerateIntervalsResult =
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

function enforceMinTotal(
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

export function generateIntervals(
  totalDurationMs: number,
  numberOfRings: number,
  variability01: number,
  rng: () => number = Math.random
): GenerateIntervalsResult {
  if (!Number.isFinite(totalDurationMs) || totalDurationMs <= 0) {
    return { ok: false, error: "Total duration must be positive." };
  }
  const n = Math.floor(numberOfRings);
  if (n < 1) {
    return { ok: false, error: "Need at least one ring." };
  }
  if (n * MIN_INTERVAL_MS > totalDurationMs + 1e-6) {
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
  const result = enforceMinTotal(normalized, totalDurationMs, MIN_INTERVAL_MS);

  if (!result) {
    return {
      ok: false,
      error: "Could not build a schedule. Try fewer rings or longer duration.",
    };
  }

  return { ok: true, intervalsMs: result };
}
