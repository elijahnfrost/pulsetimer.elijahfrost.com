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
      <header className="w-full shrink-0 px-3 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-5 sm:pb-6 sm:pt-7">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-[1fr_auto] items-center gap-x-3 gap-y-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-x-5 md:gap-y-0">
          <h1 className="col-start-1 row-start-1 self-center font-sans text-[11px] font-semibold uppercase leading-none tracking-[0.2em] text-ds-fg sm:text-[12px]">
            Pulse Timer
          </h1>
          <div className="col-start-2 row-start-1 justify-self-end self-center md:col-start-3">
            <ThemeToggle />
          </div>
          <div className="col-span-2 min-w-0 self-center md:col-span-1 md:col-start-2 md:row-start-1 md:w-max md:max-w-[min(24rem,calc(100vw-12rem))] md:justify-self-center">
            <Tabs
              active={tab}
              onChange={(k) => {
                setActiveTab(k);
                activeRef.current = k;
              }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-w-0 w-full max-w-7xl flex-1 flex-col items-stretch px-5 pb-10 pt-2 text-left font-sans antialiased sm:px-10">
        {/* Keep panels mounted so tab switches never reset in-memory state or flash defaults */}
        <div className="w-full min-w-0 max-w-7xl flex-1 text-left transition-opacity duration-ds ease-ds-out">
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
