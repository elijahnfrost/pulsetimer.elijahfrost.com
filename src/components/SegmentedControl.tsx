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
}: Props<T>) {
  const labelId = useId();

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
              className={[
                "min-h-10 max-w-full rounded-md px-3 py-2 text-left text-[10px] font-medium uppercase leading-snug tracking-[0.08em] transition-colors duration-ds sm:min-h-[2.75rem] sm:px-4 sm:text-[11px] sm:tracking-[0.1em]",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)]",
                selected
                  ? "border border-ds-fg bg-ds-fg text-ds-page"
                  : "border border-ds-divider bg-transparent text-ds-soft hover:border-ds-border hover:bg-ds-section/20 hover:text-ds-fg",
              ].join(" ")}
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
