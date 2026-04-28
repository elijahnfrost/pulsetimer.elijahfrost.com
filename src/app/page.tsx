"use client";

import { useEffect, useRef, useState } from "react";
import { IntervalTimer } from "@/components/IntervalTimer";
import { StandardTimer } from "@/components/StandardTimer";
import { Stopwatch } from "@/components/Stopwatch";
import { Tabs, TabKey } from "@/components/Tabs";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useWakeLock } from "@/hooks/useWakeLock";
import { ShortcutHandles } from "@/types/hotkeys";

const NOTIFY_ONCE_KEY = "pulse-timer:notify-session";

function coerceTab(raw: TabKey | null | undefined): TabKey {
  if (raw === "interval" || raw === "timer" || raw === "stopwatch") return raw;
  return "interval";
}

function isTypingTarget(ev: KeyboardEvent): boolean {
  const t = ev.target as HTMLElement | null;
  const tag = t?.tagName ?? "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(t?.isContentEditable);
}

export default function Home() {
  const [activeTab, setActiveTab] = useLocalStorage<TabKey>(
    "pulse-timer:active-tab-v1",
    "interval"
  );

  const activeRef = useRef<TabKey>("interval");
  activeRef.current = coerceTab(activeTab);

  const hkInterval = useRef<ShortcutHandles | null>(null);
  const hkStandard = useRef<ShortcutHandles | null>(null);
  const hkStopwatch = useRef<ShortcutHandles | null>(null);

  const [intervalAwake, setIntervalAwake] = useState(false);
  const [standardAwake, setStandardAwake] = useState(false);
  const [stopwatchAwake, setStopwatchAwake] = useState(false);

  useWakeLock(intervalAwake || standardAwake || stopwatchAwake);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (typeof Notification === "undefined") return;
      if (localStorage.getItem(NOTIFY_ONCE_KEY)) return;
      localStorage.setItem(NOTIFY_ONCE_KEY, "1");
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } catch {
      //
    }
  }, []);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      const typing = isTypingTarget(e);

      const tab = activeRef.current;

      if (e.code === "Space" && typing) return;
      if (e.code === "Enter" && typing) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (tab === "interval") hkInterval.current?.toggle?.();
        if (tab === "timer") hkStandard.current?.toggle?.();
        if (tab === "stopwatch") hkStopwatch.current?.toggle?.();
        return;
      }

      if (e.code === "Escape") {
        e.preventDefault();
        if (tab === "interval") hkInterval.current?.stop?.();
        if (tab === "timer") hkStandard.current?.stop?.();
        if (tab === "stopwatch") hkStopwatch.current?.stop?.();
        return;
      }

      if (e.code === "Enter") {
        e.preventDefault();
        if (tab === "interval") hkInterval.current?.start?.();
        if (tab === "timer") hkStandard.current?.start?.();
        if (tab === "stopwatch") hkStopwatch.current?.start?.();
      }
    };
    window.addEventListener("keydown", onDown);
    return () => window.removeEventListener("keydown", onDown);
  }, []);

  const tab = coerceTab(activeTab);

  /** Bad/migrated localStorage can store a stray value; reset so tab buttons always work. */
  useEffect(() => {
    const k = activeTab as string | undefined;
    if (
      k !== "interval" &&
      k !== "timer" &&
      k !== "stopwatch"
    ) {
      setActiveTab("interval");
    }
  }, [activeTab, setActiveTab]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-ds-page text-ds-fg">
      <header className="sticky top-0 z-10 border-b border-ds-divider bg-ds-page/90 backdrop-blur-sm">
        <div className="relative mx-auto flex w-full max-w-6xl items-center justify-center px-5 py-8 sm:px-10">
          <div className="mx-auto w-full max-w-2xl px-12 text-center sm:px-16">
            <h1 className="font-serif text-2xl font-light tracking-tight text-ds-fg sm:text-[1.75rem]">
              Pulse Timer
            </h1>
            <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-ds-soft sm:tracking-[0.24em]">
              Interval · timer · stopwatch — offline in your browser
            </p>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 sm:right-8">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-5 pb-16 pt-10 text-center sm:px-10">
        <div className="w-full max-w-3xl">
          <Tabs
            active={tab}
            onChange={(k) => {
              setActiveTab(k);
              activeRef.current = k;
            }}
          />
        </div>

        <div
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          key={tab}
          className="w-full max-w-5xl flex-1 transition-opacity duration-ds ease-ds-out"
        >
          {tab === "interval" && (
            <IntervalTimer
              actionsRef={hkInterval}
              onActivityChange={(active) => setIntervalAwake(Boolean(active))}
            />
          )}
          {tab === "timer" && (
            <StandardTimer
              actionsRef={hkStandard}
              onActivityChange={(active) => setStandardAwake(Boolean(active))}
            />
          )}
          {tab === "stopwatch" && (
            <Stopwatch
              actionsRef={hkStopwatch}
              onActivityChange={(active) => setStopwatchAwake(Boolean(active))}
            />
          )}
        </div>

        <footer className="mt-auto w-full max-w-3xl border-t border-ds-divider pt-10 text-center">
          <p className="text-[9px] uppercase tracking-[0.2em] text-ds-dim sm:text-[10px] sm:tracking-[0.22em]">
            Space pause · Enter start · Escape stop / reset
          </p>
        </footer>
      </main>
    </div>
  );
}
