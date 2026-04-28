"use client";

import { useCallback, useEffect, useRef } from "react";

const CHIME = "/sounds/chime.mp3";

function playBeepFallback(durationMs = 180): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 880;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + durationMs / 1000 + 0.05);
    setTimeout(() => ctx.close(), durationMs + 200);
  } catch {
    //
  }
}

/** Preloads bundled chime and plays via HTMLAudioElement; falls back to short Web Audio beep if needed. */
export function useAudioAlert(): () => void {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const a = new Audio(CHIME);
    a.preload = "auto";
    audioRef.current = a;
    return () => {
      a.src = "";
      audioRef.current = null;
    };
  }, []);

  return useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
      const p = a.play();
      if (p !== undefined) {
        p.catch(() => playBeepFallback());
      }
    } else {
      playBeepFallback();
    }
  }, []);
}
