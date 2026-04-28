"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type AccurateTimerControls = {
  start: () => void;
  pause: () => void;
  reset: (ms: number) => void;
  tick: (ms: number) => void;
  setDuration: (ms: number) => void;
  /** Restore a running countdown that must end exactly at absolute wall-clock time `endTs`. */
  resumeWallClockUntil: (endTs: number) => void;
  getSegmentEndTs: () => number | null;
};

/**
 * Cap React updates: never 60fps setState, but keep second ticks crisp and allow ~10/s
 * between ticks so circular progress (Standard timer) moves smoothly.
 */
const UI_MIN_INTERVAL_MS = 100;

/** Countdown using rAF vs Date.now(); no setInterval. Stops automatically at zero. */
export function useAccurateTimer(onComplete?: () => void): [number, boolean, AccurateTimerControls] {
  const [remainingMs, setRemainingMs] = useState(0);
  const [running, setRunning] = useState(false);
  const endTimeRef = useRef<number | null>(null);
  const durationRef = useRef(0);
  const lastEmitWallRef = useRef(0);
  /** Last `Math.floor(remainingMs/1000)` we pushed to React — emit when this changes for clean MM:SS. */
  const lastEmittedSecondRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!running || endTimeRef.current == null) return;

    let id = 0;
    const loop = () => {
      const end = endTimeRef.current;
      if (end == null) return;
      const left = Math.max(0, Math.round(end - Date.now()));
      const now = Date.now();
      const sec = Math.floor(left / 1000);

      if (left <= 0) {
        endTimeRef.current = null;
        durationRef.current = 0;
        lastEmitWallRef.current = 0;
        lastEmittedSecondRef.current = null;
        setRemainingMs(0);

        /** Callback usually calls reset()+start(); must not leave RAF dead when `running` stays true — React skips effect rerun. */
        onCompleteRef.current?.();

        if (endTimeRef.current != null) {
          lastEmitWallRef.current = 0;
          lastEmittedSecondRef.current = null;
          const nextLeft = Math.max(0, Math.round(endTimeRef.current - Date.now()));
          setRemainingMs(nextLeft);
          id = requestAnimationFrame(loop);
          return;
        }

        setRunning(false);
        return;
      }

      const secondChanged = lastEmittedSecondRef.current !== sec;
      const cooledDown = now - lastEmitWallRef.current >= UI_MIN_INTERVAL_MS;
      const shouldEmit = lastEmitWallRef.current === 0 || secondChanged || cooledDown;

      if (shouldEmit) {
        lastEmittedSecondRef.current = sec;
        lastEmitWallRef.current = now;
        setRemainingMs(left);
      }

      id = requestAnimationFrame(loop);
    };

    lastEmitWallRef.current = 0;
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [running]);

  const start = useCallback(() => {
    if (durationRef.current <= 0) return;
    const end = Date.now() + durationRef.current;
    endTimeRef.current = end;
    lastEmitWallRef.current = 0;
    lastEmittedSecondRef.current = null;
    setRunning(true);
    setRemainingMs(Math.max(0, Math.round(end - Date.now())));
  }, []);

  const pause = useCallback(() => {
    if (endTimeRef.current != null) {
      const left = Math.max(0, Math.round(endTimeRef.current - Date.now()));
      durationRef.current = left;
    }
    endTimeRef.current = null;
    lastEmitWallRef.current = 0;
    lastEmittedSecondRef.current = null;
    setRunning(false);
    setRemainingMs(durationRef.current);
  }, []);

  const reset = useCallback((ms: number) => {
    endTimeRef.current = null;
    durationRef.current = ms;
    lastEmitWallRef.current = 0;
    lastEmittedSecondRef.current = null;
    setRemainingMs(ms);
    setRunning(false);
  }, []);

  const resumeWallClockUntil = useCallback((endTs: number) => {
    endTimeRef.current = endTs;
    const left = Math.max(0, Math.round(endTs - Date.now()));
    durationRef.current = left;
    lastEmitWallRef.current = 0;
    lastEmittedSecondRef.current = null;
    setRemainingMs(left);
    setRunning(true);
  }, []);

  const tick = useCallback(
    (ms: number) => {
      durationRef.current = ms;
      if (running && endTimeRef.current != null) {
        endTimeRef.current = Date.now() + ms;
      }
      setRemainingMs(ms);
    },
    [running]
  );

  const setDuration = useCallback((ms: number) => {
    durationRef.current = ms;
    if (!running) {
      setRemainingMs(ms);
    }
  }, [running]);

  const getSegmentEndTs = useCallback(() => endTimeRef.current, []);

  const ctr = useMemo<AccurateTimerControls>(
    () => ({
      start,
      pause,
      reset,
      tick,
      setDuration,
      resumeWallClockUntil,
      getSegmentEndTs,
    }),
    [
      start,
      pause,
      reset,
      tick,
      setDuration,
      resumeWallClockUntil,
      getSegmentEndTs,
    ]
  );

  return [remainingMs, running, ctr];
}
