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

/** Countdown using rAF vs Date.now(); no setInterval. Stops automatically at zero. */
export function useAccurateTimer(onComplete?: () => void): [number, boolean, AccurateTimerControls] {
  const [remainingMs, setRemainingMs] = useState(0);
  const [running, setRunning] = useState(false);
  const endTimeRef = useRef<number | null>(null);
  const durationRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!running || endTimeRef.current == null) return;

    let id = 0;
    const loop = () => {
      const end = endTimeRef.current;
      if (end == null) return;
      const left = Math.max(0, Math.round(end - Date.now()));
      setRemainingMs(left);
      if (left <= 0) {
        endTimeRef.current = null;
        durationRef.current = 0;
        setRunning(false);
        onCompleteRef.current?.();
        return;
      }
      id = requestAnimationFrame(loop);
    };

    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [running]);

  const start = useCallback(() => {
    if (durationRef.current <= 0) return;
    const end = Date.now() + durationRef.current;
    endTimeRef.current = end;
    setRunning(true);
    setRemainingMs(Math.max(0, Math.round(end - Date.now())));
  }, []);

  const pause = useCallback(() => {
    if (endTimeRef.current != null) {
      const left = Math.max(0, Math.round(endTimeRef.current - Date.now()));
      durationRef.current = left;
    }
    endTimeRef.current = null;
    setRunning(false);
    setRemainingMs(durationRef.current);
  }, []);

  const reset = useCallback((ms: number) => {
    endTimeRef.current = null;
    durationRef.current = ms;
    setRemainingMs(ms);
    setRunning(false);
  }, []);

  const resumeWallClockUntil = useCallback((endTs: number) => {
    endTimeRef.current = endTs;
    const left = Math.max(0, Math.round(endTs - Date.now()));
    durationRef.current = left;
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
