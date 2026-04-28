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
      <header className="w-full shrink-0 px-4 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-10 sm:pb-8 sm:pt-8">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <h1 className="font-serif text-xl font-light tracking-tight text-ds-fg sm:text-[1.35rem]">
            Pulse Timer
          </h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-stretch px-5 pb-10 pt-2 text-center sm:px-10">
        <div className="w-full">
          <Tabs
            active={tab}
            onChange={(k) => {
              setActiveTab(k);
              activeRef.current = k;
            }}
          />
        </div>

        {/* Keep panels mounted so tab switches never reset in-memory state or flash defaults */}
        <div className="w-full max-w-6xl flex-1 transition-opacity duration-ds ease-ds-out">
          <div
            role="tabpanel"
            id="tabpanel-interval"
            aria-labelledby="tab-interval"
            hidden={tab !== "interval"}
          >
            <IntervalTimer
              actionsRef={hkInterval}
              onActivityChange={(active) => setIntervalAwake(Boolean(active))}
            />
          </div>
          <div role="tabpanel" id="tabpanel-timer" aria-labelledby="tab-timer" hidden={tab !== "timer"}>
            <StandardTimer
              actionsRef={hkStandard}
              onActivityChange={(active) => setStandardAwake(Boolean(active))}
            />
          </div>
          <div
            role="tabpanel"
            id="tabpanel-stopwatch"
            aria-labelledby="tab-stopwatch"
            hidden={tab !== "stopwatch"}
          >
            <Stopwatch
              actionsRef={hkStopwatch}
              onActivityChange={(active) => setStopwatchAwake(Boolean(active))}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
