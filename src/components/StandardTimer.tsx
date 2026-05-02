"use client";

import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { ShortcutHandles } from "@/types/hotkeys";
import { formatMmSs } from "@/lib/formatTime";
import { useAccurateTimer } from "@/hooks/useAccurateTimer";
import { primeAudioFromUserGesture, useAudioAlert } from "@/hooks/useAudioAlert";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { CircularProgress } from "./CircularProgress";
import { ControlButton, ControlsRow } from "./Controls";
import { BigRow } from "./BigRow";
import { HmsClock } from "./BigEditors";

const STORAGE_KEY = "pulse-timer:standard-v1";

type Persist = {
  h: number;
  m: number;
  s: number;
  mode: "idle" | "running" | "done";
  deadlineTs: number | null;
};

function loadStored(): Persist | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Persist) : null;
  } catch {
    return null;
  }
}

function saveStored(p: Persist) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    //
  }
}

type Props = {
  actionsRef?: MutableRefObject<ShortcutHandles | null>;
  onActivityChange?: (active: boolean) => void;
};

export function StandardTimer({ actionsRef, onActivityChange }: Props) {
  const playChime = useAudioAlert();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [h, setH] = useState(0);
  const [mm, setMm] = useState(25);
  const [ss, setSs] = useState(0);
  const [mode, setMode] = useState<"idle" | "running" | "done">("idle");
  const [flash, setFlash] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const doneHandler = useRef<() => void>(() => {});

  const [remainingMs, isRunning, ctr] = useAccurateTimer(() => doneHandler.current());

  const targetMs = Math.max(1000, h * 3600000 + (mm % 60) * 60000 + (ss % 60) * 1000);

  const snapshot = useCallback((): Persist => {
    return {
      h,
      m: mm,
      s: ss,
      mode,
      deadlineTs: isRunning ? ctr.getSegmentEndTs() : null,
    };
  }, [h, mm, ss, mode, isRunning, ctr]);

  const finish = useCallback(() => {
    playChime("timerComplete");
    if (!prefersReducedMotion) {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 300);
    } else {
      setFlash(false);
    }
    setMode("done");
    ctr.reset(0);
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification("Pulse Timer", { body: "Timer finished." });
      } catch {
        //
      }
    }
  }, [ctr, playChime, prefersReducedMotion]);

  doneHandler.current = finish;

  useEffect(() => {
    const s = loadStored();
    if (s) {
      setH(s.h);
      setMm(s.m);
      setSs(s.s);
      setMode(s.mode);
      requestAnimationFrame(() => {
        if (s.mode === "running" && s.deadlineTs != null && s.deadlineTs > Date.now()) {
          ctr.resumeWallClockUntil(s.deadlineTs);
        } else if (s.mode === "done") {
          ctr.reset(0);
        } else {
          const t = s.h * 3600000 + (s.m % 60) * 60000 + (s.s % 60) * 1000;
          ctr.reset(Math.max(1000, t));
        }
      });
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveStored(snapshot());
  }, [hydrated, snapshot]);

  useEffect(() => {
    const flush = () => saveStored(snapshot());
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [snapshot]);

  useEffect(() => {
    if (!hydrated) return;
    if (mode !== "running" || !isRunning) return;
    const id = window.setInterval(() => saveStored(snapshot()), 2000);
    return () => window.clearInterval(id);
  }, [hydrated, mode, isRunning, snapshot]);

  useEffect(() => {
    onActivityChange?.(isRunning && mode === "running");
  }, [isRunning, mode, onActivityChange]);

  const start = () => {
    primeAudioFromUserGesture();
    ctr.reset(targetMs);
    setMode("running");
    ctr.start();
  };

  const pause = () => {
    ctr.pause();
  };

  const reset = () => {
    ctr.pause();
    ctr.reset(targetMs);
    setMode("idle");
  };

  useEffect(() => {
    if (!actionsRef) return;
    actionsRef.current = {
      toggle: () => {
        if (mode === "done") {
          reset();
          return;
        }
        primeAudioFromUserGesture();
        if (isRunning) pause();
        else start();
      },
      stop: () => reset(),
      start: () => {
        if (mode === "idle") start();
      },
    };
    return () => {
      if (actionsRef) actionsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionsRef, mode, isRunning, targetMs]);

  const showTargetWhileIdle = mode === "idle" && !isRunning;
  const displayMs = mode === "done" ? 0 : showTargetWhileIdle ? targetMs : Math.max(0, remainingMs);
  const display = mode === "done" ? "Done" : formatMmSs(displayMs);
  const progressed =
    mode === "done" ? 1 : showTargetWhileIdle ? 0 : 1 - Math.min(1, Math.max(0, remainingMs) / targetMs);

  return (
    <div className="mt-10 w-full text-center transition-opacity duration-ds ease-ds-out">
      <section
        aria-label="Standard countdown"
        className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10 text-center sm:px-10"
      >
        <div className="mx-auto flex w-full max-w-md min-w-0 flex-col overflow-hidden rounded-md border border-ds-divider">
          <BigRow label="TMR">
            <HmsClock
              phaseLetter="Timer"
              hours={h}
              minutes={mm}
              seconds={ss}
              onSetHms={(newH, newM, newS) => {
                if (!isRunning) {
                  setH(newH);
                  setMm(newM);
                  setSs(newS);
                }
              }}
            />
          </BigRow>
        </div>

        <CircularProgress
          progress={mode === "done" ? 1 : progressed}
          flashing={flash}
          reducedMotion={prefersReducedMotion}
          ringContent={mode === "done" ? "free" : "digits"}
        >
          {mode === "done" ? (
            <span className="font-display text-[clamp(1.65rem,min(8vmin,9vw),2.85rem)] font-light tracking-tight text-ds-bright">
              Done
            </span>
          ) : (
            display
          )}
        </CircularProgress>

        <ControlsRow>
          {mode === "idle" ? (
            <>
              <ControlButton onClick={start}>Start</ControlButton>
              <ControlButton variant="secondary" className="invisible pointer-events-none" tabIndex={-1}>Stop</ControlButton>
            </>
          ) : isRunning ? (
            <>
              <ControlButton onClick={pause}>Pause</ControlButton>
              <ControlButton variant="secondary" onClick={stop}>Stop</ControlButton>
            </>
          ) : mode === "done" ? (
            <>
              <ControlButton onClick={reset}>Reset</ControlButton>
              <ControlButton variant="secondary" className="invisible pointer-events-none" tabIndex={-1}>Stop</ControlButton>
            </>
          ) : (
            <>
              <ControlButton onClick={start}>Resume</ControlButton>
              <ControlButton variant="secondary" onClick={stop}>Stop</ControlButton>
            </>
          )}
        </ControlsRow>
      </section>
    </div>
  );
}
