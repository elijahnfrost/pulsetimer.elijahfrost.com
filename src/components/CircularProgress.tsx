"use client";

import { ReactNode, useMemo } from "react";

type Props = {
  /** 0–1 elapsed fraction within the current chunk (0 = segment start). */
  progress: number;
  children: ReactNode;
  flashing?: boolean;
  reducedMotion?: boolean;
  /** `digits`: countdown time; `free`: e.g. serif “Done”. */
  ringContent?: "digits" | "free";
};

const VIEW = 240;
const SW = 5;
const R = (VIEW - SW) / 2;
const C = 2 * Math.PI * R;

export function CircularProgress({
  progress,
  children,
  flashing,
  reducedMotion,
  ringContent = "digits",
}: Props) {
  const p = Math.min(1, Math.max(0, progress));
  const dash = useMemo(() => C * (1 - p), [p]);

  const strokeAccent = flashing ? "var(--color-fg-bright)" : "var(--color-fg-soft)";

  return (
    <div
      className={`relative mx-auto aspect-square w-[min(100%,min(92vw,380px))] max-w-[100%] transition-transform duration-300 ease-ds-out ${
        flashing && !reducedMotion ? "scale-[1.02]" : "scale-100"
      }`}
      style={flashing && reducedMotion ? { transition: "none" } : undefined}
    >
      <svg
        className="block h-full w-full"
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        preserveAspectRatio="xMidYMid meet"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p * 100)}
        aria-valuetext={`${Math.round(p * 100)} percent`}
        role="progressbar"
      >
        <circle
          cx={VIEW / 2}
          cy={VIEW / 2}
          r={R}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={SW}
          transform={`rotate(-90 ${VIEW / 2} ${VIEW / 2})`}
        />
        <circle
          cx={VIEW / 2}
          cy={VIEW / 2}
          r={R}
          fill="none"
          stroke={strokeAccent}
          strokeWidth={SW}
          strokeLinecap="butt"
          strokeDasharray={C}
          strokeDashoffset={dash}
          className="transition-colors duration-300 ease-ds-out"
          transform={`rotate(-90 ${VIEW / 2} ${VIEW / 2})`}
        />
      </svg>
      <div className="pointer-events-none absolute inset-[12%] flex items-center justify-center overflow-hidden">
        <div
          className={
            ringContent === "free"
              ? "flex max-h-full w-full max-w-full flex-col items-center justify-center px-1 text-center leading-none text-ds-bright"
              : "tabular-nums-in-ring max-h-full w-full max-w-full px-0.5 text-center leading-none text-ds-fg"
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
