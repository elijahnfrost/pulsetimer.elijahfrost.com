"use client";

import { useEffect, useRef, useState } from "react";
import { IntervalTimer } from "@/components/IntervalTimer";
import { StandardTimer } from "@/components/StandardTimer";
import { Stopwatch } from "@/components/Stopwatch";
import { Tabs, TabKey } from "@/components/Tabs";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useWakeLock } from "@/hooks/useWakeLock";
import { ShortcutHandles } from "@/types/hotkeys";

const NOTIFY_ONCE_KEY = "pulse-timer:notify-session";

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

  const activeRef = useRef<TabKey>(activeTab ?? "interval");
  activeRef.current = activeTab ?? "interval";

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

  const tab = activeTab ?? "interval";

  return (
    <main className="space-y-8">
      <header className="text-center space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Pulse Timer</h1>
        <p className="text-[0.875rem] text-pulse-muted">
          Interval · classic timer · stopwatch — all offline in your browser.
        </p>
      </header>

      <Tabs
        active={tab}
        onChange={(k) => {
          setActiveTab(k);
          activeRef.current = k;
        }}
      />

      <div
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        key={tab}
        className="transition-opacity duration-150 ease-out opacity-100"
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
    </main>
  );
}
