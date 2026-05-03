"use client";

import type { CSSProperties } from "react";

type Props = {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  /** Extra classes on the wrapper (width constraints, etc.) */
  className?: string;
};

/** value 0–100 */
export function VariabilitySlider({ value, onChange, disabled, className = "" }: Props) {
  const sliderStyle = { "--slider-pct": `${value}%` } as CSSProperties;

  return (
    <div className={["flex w-full flex-col gap-2", className].filter(Boolean).join(" ")}>
      <div className="flex min-h-[1rem] flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.14em] text-ds-soft sm:tracking-[0.16em]">
        <label htmlFor="variability-slider" className="shrink-0">
          Variability
        </label>
        <span
          aria-live="polite"
          className="shrink-0 font-mono text-[12px] tabular-nums text-ds-fg"
        >
          {value}%
        </span>
      </div>
      <input
        id="variability-slider"
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        disabled={disabled}
        aria-valuetext={`${value} percent`}
        className="variability-slider w-full"
        style={sliderStyle}
        onChange={(e) => onChange(Number(e.target.value))}
        onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
      />
    </div>
  );
}
