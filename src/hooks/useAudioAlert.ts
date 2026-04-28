"use client";

import { useCallback, useEffect } from "react";

const CHIME_URL = "/sounds/chime.mp3";

export type AlertKind = "interval" | "timerComplete";

export type PlayAlertOptions = {
  /** Short tones played at each interval boundary (1 = single ping). */
  intervalRepeats?: number;
  /** Linear output multiplier 0–1. */
  intervalVolume?: number;
};

const DEFAULT_INTERVAL_REPEATS = 5;
const DEFAULT_INTERVAL_VOLUME = 0.85;
const INTERVAL_BASE_PEAK = 0.38;

let sharedCtx: AudioContext | null = null;
let chimeBuffer: AudioBuffer | null = null;
let chimeLoadPromise: Promise<AudioBuffer | null> | null = null;
let unlockListenersAttached = false;

function getAudioContext(): AudioContext {
  const AC =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new AC();
  }
  return sharedCtx;
}

function attachUnlockListeners() {
  if (unlockListenersAttached || typeof window === "undefined") return;
  unlockListenersAttached = true;
  const unlock = () => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === "suspended") void ctx.resume();
    } catch {
      //
    }
  };
  window.addEventListener("pointerdown", unlock, { capture: true, passive: true });
  window.addEventListener("keydown", unlock, { capture: true, passive: true });
}

async function ensureAudioRunning(ctx: AudioContext): Promise<void> {
  if (ctx.state === "closed") return;
  try {
    if (ctx.state !== "running") {
      await ctx.resume().catch(() => {});
    }
    if (ctx.state !== "running") {
      await new Promise<void>((r) => setTimeout(r, 70));
      await ctx.resume().catch(() => {});
    }
  } catch {
    //
  }
}

function clampIntervalRepeats(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_INTERVAL_REPEATS;
  return Math.max(1, Math.min(12, Math.round(n)));
}

function clampUnitVolume(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_INTERVAL_VOLUME;
  return Math.max(0, Math.min(1, v));
}

async function loadChimeBuffer(ctx: AudioContext): Promise<AudioBuffer | null> {
  if (chimeBuffer) return chimeBuffer;
  if (!chimeLoadPromise) {
    chimeLoadPromise = (async () => {
      try {
        const res = await fetch(CHIME_URL);
        if (!res.ok) return null;
        const raw = await res.arrayBuffer();
        return await ctx.decodeAudioData(raw.slice(0));
      } catch {
        return null;
      }
    })();
  }
  const decoded = await chimeLoadPromise;
  if (decoded) chimeBuffer = decoded;
  return chimeBuffer;
}

/** One short sine ping; `when` is AudioContext time. */
function ping(ctx: AudioContext, when: number, durationSec: number, freq: number, peak = 0.22): void {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, when);
  const t1 = when + Math.max(0.04, durationSec);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t1);
  osc.start(when);
  osc.stop(t1 + 0.02);
}

/** Short chimes in a row (each interval segment end). */
function playIntervalCluster(
  ctx: AudioContext,
  t0: number,
  repeats: number,
  volumeLinear: number
): void {
  const beep = 0.1;
  const gap = 0.11;
  const freq = 905;
  const peak = INTERVAL_BASE_PEAK * volumeLinear;
  if (peak < 0.0005) return;
  const n = clampIntervalRepeats(repeats);
  for (let k = 0; k < n; k++) {
    ping(ctx, t0 + k * (beep + gap), beep, freq, peak);
  }
}

/** Longer completion swell for the main countdown timer (distinct from interval ticks). */
function playTimerCompleteChime(ctx: AudioContext, t0: number): void {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(720, t0);
  osc.frequency.exponentialRampToValueAtTime(360, t0 + 0.88);
  const dur = 1.35;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.32, t0 + 0.05);
  g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.45);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.start(t0);
  osc.stop(t0 + dur + 0.06);

  ping(ctx, t0 + dur + 0.02, 0.16, 480, 0.15);
}

async function playAlertAsync(kind: AlertKind, opts?: PlayAlertOptions): Promise<void> {
  attachUnlockListeners();
  const intervalRepeats = clampIntervalRepeats(opts?.intervalRepeats ?? DEFAULT_INTERVAL_REPEATS);
  const intervalVol = clampUnitVolume(opts?.intervalVolume ?? DEFAULT_INTERVAL_VOLUME);

  try {
    const ctx = getAudioContext();
    await ensureAudioRunning(ctx);

    if (kind === "interval") {
      if (intervalVol < 0.003) return;

      /** Load sample first, then schedule from a single time base so spacing stays even. */
      const buf = await loadChimeBuffer(ctx);
      await ensureAudioRunning(ctx);
      const tBase = ctx.currentTime;

      if (buf && buf.duration > 0 && buf.duration < 0.4) {
        const step = buf.duration + 0.09;
        const samplePeak = Math.min(0.92, 0.52 * intervalVol);
        for (let k = 0; k < intervalRepeats; k++) {
          const src = ctx.createBufferSource();
          const gain = ctx.createGain();
          src.buffer = buf;
          src.connect(gain);
          gain.connect(ctx.destination);
          const when = tBase + k * step;
          gain.gain.setValueAtTime(0.0001, when);
          gain.gain.linearRampToValueAtTime(samplePeak, when + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, when + buf.duration);
          src.start(when);
        }
        return;
      }
      playIntervalCluster(ctx, tBase, intervalRepeats, intervalVol);
      return;
    }

    playTimerCompleteChime(ctx, ctx.currentTime);
  } catch {
    try {
      const ctx = getAudioContext();
      await ensureAudioRunning(ctx);
      const t0 = ctx.currentTime;
      if (kind === "interval") {
        if (intervalVol < 0.003) return;
        playIntervalCluster(ctx, t0, intervalRepeats, intervalVol);
      } else playTimerCompleteChime(ctx, t0);
    } catch {
      //
    }
  }
}

/**
 * Run inside a click / keydown handler so mobile Safari unlocks output before a timer fires asynchronously.
 */
export function primeAudioFromUserGesture(): void {
  attachUnlockListeners();
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    //
  }
}

export function useAudioAlert(): (kind: AlertKind, opts?: PlayAlertOptions) => void {
  useEffect(() => {
    attachUnlockListeners();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void (async () => {
        try {
          const ctx = getAudioContext();
          await ensureAudioRunning(ctx);
        } catch {
          //
        }
      })();
    };
    document.addEventListener("visibilitychange", onVisible);
    void (async () => {
      try {
        const ctx = getAudioContext();
        await loadChimeBuffer(ctx);
      } catch {
        //
      }
    })();
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return useCallback((kind: AlertKind, opts?: PlayAlertOptions) => {
    void playAlertAsync(kind, opts);
  }, []);
}
