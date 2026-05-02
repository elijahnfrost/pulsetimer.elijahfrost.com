"use client";

import { useId } from "react";

type Option<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  /** Accessible name when `showLabel` is false; also shown above options when `showLabel` is true */
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  /** When false, parent supplies the visible title; `label` is still used for `aria-label`. */
  showLabel?: boolean;
  /** Tighter typography and corners (pair with hairline-heavy editors). */
  variant?: "default" | "crisp";
};

/**
 * Mutually exclusive choices as chips. Prefer one titled section per usage:
 * either show the built-in label or hide it and use a parent heading.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  showLabel = true,
  variant = "default",
}: Props<T>) {
  const labelId = useId();

  const chipClasses =
    variant === "crisp"
      ? [
          "min-h-12 max-w-full rounded-sm px-4 py-3 text-left text-[11px] font-semibold uppercase leading-snug tracking-[0.14em] transition-colors duration-ds sm:min-h-[3.25rem] sm:px-5 sm:py-3.5 sm:text-[12px] sm:tracking-[0.15em]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)]",
        ]
      : [
          "min-h-12 max-w-full rounded-md px-4 py-3 text-left text-[11px] font-medium uppercase leading-snug tracking-[0.12em] transition-colors duration-ds sm:min-h-[3.25rem] sm:px-5 sm:text-[12px] sm:tracking-[0.14em]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)]",
        ];

  const selectedClass =
    variant === "crisp"
      ? "border border-ds-fg bg-ds-fg text-ds-page"
      : "border border-ds-fg bg-ds-fg text-ds-page";

  /** Inactive crisp chips: surface only (no stroked rectangle) — lines stay on the selected control. */
  const inactiveClass =
    variant === "crisp"
      ? "border border-transparent bg-ds-section/20 text-ds-body hover:bg-ds-section/40 hover:text-ds-fg"
      : "border border-ds-divider bg-transparent text-ds-soft hover:border-ds-border hover:bg-ds-section/20 hover:text-ds-fg";

  return (
    <div className="min-w-0">
      {showLabel ? (
        <p
          id={labelId}
          className="mb-3 block w-full text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-ds-fg sm:text-xs sm:tracking-[0.15em]"
        >
          {label}
        </p>
      ) : null}
      <div
        role="radiogroup"
        aria-labelledby={showLabel ? labelId : undefined}
        aria-label={showLabel ? undefined : label}
        className="flex min-w-0 flex-wrap gap-2"
      >
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={[...chipClasses, selected ? selectedClass : inactiveClass].join(" ")}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
