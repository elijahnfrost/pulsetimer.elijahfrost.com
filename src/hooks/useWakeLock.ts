"use client";

import { useEffect, useRef } from "react";

type ScreenWakeSentinel = {
  release(): Promise<void>;
  addEventListener(type: "release", listener: () => void): void;
};

export function useWakeLock(active: boolean): void {
  const lockRef = useRef<ScreenWakeSentinel | null>(null);

  useEffect(() => {
    if (!active) {
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
      return;
    }

    const request = async () => {
      if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
      try {
        const wl = navigator as Navigator & {
          wakeLock?: { request: (t: "screen") => Promise<ScreenWakeSentinel> };
        };
        lockRef.current = await wl.wakeLock!.request("screen");
        lockRef.current.addEventListener("release", () => {
          lockRef.current = null;
        });
      } catch {
        //
      }
    };

    request();

    const onVis = () => {
      if (document.visibilityState === "visible" && active) {
        request();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}
