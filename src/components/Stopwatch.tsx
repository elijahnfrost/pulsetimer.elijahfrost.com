"use client";

import { MutableRefObject, useEffect, useRef, useState } from "react";
import { ShortcutHandles } from "@/types/hotkeys";
import { formatElapsedWithMs } from "@/lib/formatTime";
import { ControlButton, ControlsRow } from "./Controls";

const STORAGE_KEY = "pulse-timer:stopwatch-v1";

export type Lap = {
  lapMs: number;
  cumulativeMs: number;
};

type PersistShape = {
  running: boolean;
  pausedOffsetMs: number;
  lapAnchorTs: number | null;
  laps: Lap[];
};

function loadStored(): PersistShape | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistShape) : null;
  } catch {
    return null;
  }
}

function saveStored(p: PersistShape) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    //
  }
}

function nowElapsed(pausedOffsetMs: number, lapAnchorTs: number | null): number {
  if (lapAnchorTs == null) return pausedOffsetMs;
  return pausedOffsetMs + (Date.now() - lapAnchorTs);
}

type Props = {
  actionsRef?: MutableRefObject<ShortcutHandles | null>;
  onActivityChange?: (active: boolean) => void;
};

export function Stopwatch({ actionsRef, onActivityChange }: Props) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const pausedOffsetRef = useRef(0);
  const lapAnchorRef = useRef<number | null>(null);
  const lastRoundedRef = useRef(0);

  useEffect(() => {
    const s = loadStored();
    if (s) {
      pausedOffsetRef.current = s.pausedOffsetMs ?? 0;
      lapAnchorRef.current = s.lapAnchorTs;
      setRunning(Boolean(s.running && s.lapAnchorTs != null));
      setLaps(s.laps ?? []);
      const e = nowElapsed(pausedOffsetRef.current, lapAnchorRef.current);
      setElapsedMs(e);
      lastRoundedRef.current = Math.floor(e / 10);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    onActivityChange?.(running);
  }, [running, onActivityChange]);

  useEffect(() => {
    if (!running || lapAnchorRef.current == null) return;
    let raf = 0;
    const loop = () => {
      const e = nowElapsed(pausedOffsetRef.current, lapAnchorRef.current);
      const rounded = Math.floor(e / 10) * 10;
      if (rounded !== lastRoundedRef.current) {
        lastRoundedRef.current = rounded;
        setElapsedMs(rounded);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  useEffect(() => {
    if (!hydrated) return;
    saveStored({
      running,
      pausedOffsetMs: pausedOffsetRef.current,
      lapAnchorTs: running ? lapAnchorRef.current : null,
      laps,
    });
  }, [hydrated, running, elapsedMs, laps]);

  useEffect(() => {
    const flush = () => {
      saveStored({
        running,
        pausedOffsetMs: pausedOffsetRef.current,
        lapAnchorTs: running ? lapAnchorRef.current : null,
        laps,
      });
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [running, laps]);

  const start = () => {
    pausedOffsetRef.current = nowElapsed(pausedOffsetRef.current, lapAnchorRef.current);
    lapAnchorRef.current = Date.now();
    setRunning(true);
  };

  const pause = () => {
    pausedOffsetRef.current = nowElapsed(pausedOffsetRef.current, lapAnchorRef.current);
    lapAnchorRef.current = null;
    setRunning(false);
    setElapsedMs(pausedOffsetRef.current);
  };

  const reset = () => {
    pausedOffsetRef.current = 0;
    lapAnchorRef.current = null;
    lastRoundedRef.current = 0;
    setRunning(false);
    setElapsedMs(0);
    setLaps([]);
  };

  const lapNow = () => {
    const e = nowElapsed(pausedOffsetRef.current, lapAnchorRef.current);
    const lastCum = laps.length ? laps[laps.length - 1]?.cumulativeMs ?? 0 : 0;
    const lapGap = laps.length === 0 ? e : Math.max(0, e - lastCum);
    setLaps((prev) => [...prev, { lapMs: lapGap, cumulativeMs: e }]);
  };

  useEffect(() => {
    if (!actionsRef) return;
    actionsRef.current = {
      toggle: () => (running ? pause() : start()),
      stop: () => reset(),
      start: () => {
        if (!running) start();
      },
    };
    return () => {
      if (actionsRef) actionsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionsRef, running]);

  return (
    <div className="mx-auto mt-8 w-full space-y-8 text-center transition-opacity duration-ds ease-ds-out">
      <section aria-label="Stopwatch" className="mx-auto w-full max-w-3xl space-y-8 border border-ds-section bg-ds-page px-4 py-8 sm:px-10">
        <div
          className="tabular-nums-display mx-auto w-full max-w-4xl px-2 text-center text-ds-fg"
          aria-live="polite"
        >
          {formatElapsedWithMs(Math.max(0, elapsedMs))}
        </div>

        <ControlsRow>
          <ControlButton aria-label={running ? "Stop" : "Start"} onClick={() => (running ? pause() : start())}>
            {running ? "Stop" : "Start"}
          </ControlButton>
          <ControlButton variant="secondary" aria-label="Lap time" disabled={!running} onClick={lapNow}>
            Lap
          </ControlButton>
          <ControlButton variant="secondary" aria-label="Reset stopwatch" onClick={reset}>
            Reset
          </ControlButton>
        </ControlsRow>

        {laps.length > 0 ? (
          <div className="mx-auto max-h-48 max-w-2xl overflow-y-auto border border-ds-divider p-4 text-center">
            <ol className="space-y-2 font-mono text-sm text-ds-fg">
              {laps.map((l, idx) => (
                <li key={`${idx}-${l.cumulativeMs}`}>
                  Lap {idx + 1}: {formatElapsedWithMs(l.lapMs)} · total {formatElapsedWithMs(l.cumulativeMs)}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </section>
    </div>
  );
}
