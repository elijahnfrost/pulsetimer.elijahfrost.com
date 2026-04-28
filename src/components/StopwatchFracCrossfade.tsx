"use client";

import { useEffect, useRef, useState } from "react";

const OUT_MS = 150;
const IN_MS = 220;

type Props = {
  frac: string;
  reducedMotion: boolean;
};

/**
 * Crossfades centisecond digits so the previous value does not linger at full opacity
 * while the next eases in (middle ground vs instant swap).
 */
export function StopwatchFracCrossfade({ frac, reducedMotion }: Props) {
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const clearRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prevRef = useRef(frac);

  useEffect(() => {
    if (reducedMotion) {
      prevRef.current = frac;
      setOutgoing(null);
      return;
    }
    if (frac === prevRef.current) return;
    setOutgoing(prevRef.current);
    prevRef.current = frac;
    if (clearRef.current) clearTimeout(clearRef.current);
    clearRef.current = setTimeout(() => {
      setOutgoing(null);
      clearRef.current = undefined;
    }, Math.max(OUT_MS, IN_MS));
    return () => {
      if (clearRef.current) clearTimeout(clearRef.current);
    };
  }, [frac, reducedMotion]);

  if (reducedMotion) {
    return <span className="tabular-nums">{frac}</span>;
  }

  return (
    <span className="relative isolate inline-flex min-w-[2.15ch] shrink-0 justify-end font-[inherit] leading-none">
      {outgoing != null ? (
        <span
          aria-hidden
          key={outgoing}
          style={{ animationDuration: `${OUT_MS}ms` }}
          className="pointer-events-none absolute inset-0 z-0 flex justify-end tabular-nums animate-stopwatch-frac-out"
        >
          {outgoing}
        </span>
      ) : null}
      <span
        key={frac}
        style={{ animationDuration: `${IN_MS}ms` }}
        className="relative z-[1] tabular-nums animate-stopwatch-frac-in"
      >
        {frac}
      </span>
    </span>
  );
}
