"use client";

import { ReactNode, useMemo } from "react";

type Props = {
  /** 0–1 elapsed fraction within the current chunk (0 = segment start). */
  progress: number;
  children: ReactNode;
  flashing?: boolean;
  reducedMotion?: boolean;
};

const SIZE = 240;
const SW = 6;
const R = (SIZE - SW) / 2;
const C = 2 * Math.PI * R;

export function CircularProgress({ progress, children, flashing, reducedMotion }: Props) {
  const p = Math.min(1, Math.max(0, progress));
  const dash = useMemo(() => C * (1 - p), [p]);

  return (
    <div
      className={`relative mx-auto flex items-center justify-center transition-transform duration-[300ms] ease-out ${
        flashing && !reducedMotion ? "scale-[1.03]" : "scale-100"
      }`}
      style={
        flashing && reducedMotion
          ? { transition: "none" }
          : undefined
      }
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p * 100)}
        aria-valuetext={`${Math.round(p * 100)} percent`}
        role="progressbar"
        className="block shrink-0"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--pulse-border)"
          strokeWidth={SW}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={
            flashing
              ? "var(--pulse-alert)"
              : "var(--pulse-accent)"
          }
          strokeWidth={SW}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={dash}
          className="transition-colors duration-[300ms]"
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-center px-4">
        {children}
      </div>
    </div>
  );
}
