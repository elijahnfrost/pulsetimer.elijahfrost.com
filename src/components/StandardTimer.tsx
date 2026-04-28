"use client";

import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { ShortcutHandles } from "@/types/hotkeys";
import { formatMmSs } from "@/lib/formatTime";
import { useAccurateTimer } from "@/hooks/useAccurateTimer";
import { primeAudioFromUserGesture, useAudioAlert } from "@/hooks/useAudioAlert";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { CircularProgress } from "./CircularProgress";
import { ControlButton, ControlsRow } from "./Controls";
import { NumberInput } from "./NumberInput";

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

  const progressed = 1 - Math.min(1, Math.max(0, remainingMs) / targetMs);
  const display = mode === "done" ? "Done" : formatMmSs(Math.max(0, remainingMs));

  return (
    <div className="mt-8 w-full space-y-8 text-center transition-opacity duration-ds ease-ds-out">
      <section
        aria-label="Standard countdown"
        className="mx-auto w-full max-w-3xl space-y-8 border border-ds-section bg-ds-page px-4 py-8 text-center sm:px-10"
      >
        <div className="flex flex-wrap justify-center gap-6">
          <NumberInput label="Hours" value={h} min={0} max={999} onChange={setH} disabled={isRunning} />
          <NumberInput
            label="Minutes"
            value={mm}
            min={0}
            max={59}
            onChange={(n) => setMm(((n % 60) + 60) % 60)}
            disabled={isRunning}
          />
          <NumberInput
            label="Seconds"
            value={ss}
            min={0}
            max={59}
            onChange={(n) => setSs(((n % 60) + 60) % 60)}
            disabled={isRunning}
          />
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
          <ControlButton
            aria-label={isRunning ? "Pause" : mode === "done" ? "Reset" : "Start"}
            onClick={() => {
              if (mode === "done") reset();
              else if (isRunning) pause();
              else start();
            }}
          >
            {mode === "done" ? "Reset" : isRunning ? "Pause" : "Start"}
          </ControlButton>
          <ControlButton variant="secondary" aria-label="Reset timer" onClick={reset}>
            Reset
          </ControlButton>
        </ControlsRow>
      </section>
    </div>
  );
}
