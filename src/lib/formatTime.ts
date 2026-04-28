/** Pad with leading zeros. */
export function pad2(n: number): string {
  return String(Math.floor(n)).padStart(2, "0");
}

/** Total milliseconds → MM:SS display (counts down/up). */
export function formatMmSs(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

/** HH:MM:SS for totals ≥ 1h. */
export function formatHMS(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(s)}`;
  return `${pad2(m)}:${pad2(s)}`;
}

/** Stopwatch HH:MM:SS.ms at 10ms resolution. */
export function formatElapsedWithMs(ms: number): string {
  const total = Math.max(0, ms);
  const h = Math.floor(total / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const frac = Math.floor((total % 1000) / 10);
  if (h > 0) {
    return `${h}:${pad2(m)}:${pad2(s)}.${String(frac).padStart(2, "0")}`;
  }
  return `${pad2(m)}:${pad2(s)}.${String(frac).padStart(2, "0")}`;
}

/** Status line fragment: Ring k of N · MM:SS remaining. */
export function formatRingRemainingLine(
  ringOneBased: number,
  totalRings: number,
  totalRemainingMs: number
): string {
  return `Ring ${ringOneBased} of ${totalRings} · ${formatMmSs(totalRemainingMs)} remaining.`;
}
