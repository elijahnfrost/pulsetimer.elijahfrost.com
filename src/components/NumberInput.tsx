"use client";

import { useState } from "react";

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  /** Step applied to wheel deltas and buttons */
  step?: number;
  disabled?: boolean;
  /**
   * When false, only coerces to a non-negative integer; min/max are not applied to values
   * (use for fields where a parent normalizes overflow, e.g. seconds → minutes).
   */
  strictClamp?: boolean;
  /**
   * When true (use with strictClamp false), typing stays local until blur, then commits once.
   * ± and scroll still apply immediately.
   */
  commitOnBlur?: boolean;
  /** Overrides default − button disabled rule */
  disableDec?: boolean;
  /** Overrides default + button disabled rule */
  disableInc?: boolean;
};

export function NumberInput({
  label,
  value,
  min,
  max,
  onChange,
  step = 1,
  disabled,
  strictClamp = true,
  commitOnBlur = false,
  disableDec,
  disableInc,
}: Props) {
  const [textDraft, setTextDraft] = useState<string | null>(null);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const coerceNonNegInt = (n: number) =>
    Math.max(0, Math.trunc(Number.isFinite(n) ? n : 0));

  const decDisabled = disabled || (disableDec ?? (strictClamp && value <= min));
  const incDisabled = disabled || (disableInc ?? (strictClamp && value >= max));

  const clearDraft = () => setTextDraft(null);

  const inputDisplay = commitOnBlur
    ? textDraft !== null
      ? textDraft
      : String(value)
    : value;

  const flushDraftOnBlur = () => {
    if (!commitOnBlur || textDraft === null) return;
    const t = textDraft.trim();
    if (t === "") {
      clearDraft();
      return;
    }
    const n = Number(t);
    if (!Number.isFinite(n)) {
      clearDraft();
      return;
    }
    onChange(coerceNonNegInt(n));
    clearDraft();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.2em] text-ds-soft sm:text-[10px] sm:tracking-[0.22em]">{label}</span>
      <div className="flex overflow-hidden border border-ds-section bg-ds-page focus-within:border-ds-hover">
        <button
          type="button"
          className="flex h-12 w-11 shrink-0 items-center justify-center text-ds-muted transition-colors duration-ds hover:bg-transparent hover:text-ds-fg disabled:opacity-35 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-fg-muted)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-page)]"
          aria-label={`Decrease ${label}`}
          disabled={decDisabled}
          onClick={() => {
            clearDraft();
            onChange(strictClamp ? clamp(value - step) : value - step);
          }}
        >
          −
        </button>
        <input
          className="h-12 w-14 shrink-0 border-x border-ds-divider bg-transparent text-center font-mono text-base text-ds-fg outline-none transition-colors duration-100 placeholder:text-ds-label [appearance:textfield] focus:border-transparent sm:w-16 sm:text-lg [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          disabled={disabled}
          type={commitOnBlur ? "text" : "number"}
          inputMode="numeric"
          aria-label={label}
          {...(commitOnBlur ? {} : { min, max: strictClamp ? max : undefined })}
          value={inputDisplay}
          onFocus={() => {
            if (commitOnBlur) setTextDraft(String(value));
          }}
          onChange={(e) => {
            if (commitOnBlur) {
              setTextDraft(e.target.value);
              return;
            }
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            onChange(strictClamp ? clamp(n) : coerceNonNegInt(n));
          }}
          onBlur={() => flushDraftOnBlur()}
          onWheel={(e) => {
            if (disabled || document.activeElement !== e.currentTarget) return;
            e.preventDefault();
            clearDraft();
            const delta = e.deltaY > 0 ? step : -step;
            onChange(strictClamp ? clamp(value + delta) : value + delta);
          }}
        />
        <button
          type="button"
          className="flex h-12 w-11 shrink-0 items-center justify-center text-ds-muted transition-colors duration-ds hover:text-ds-fg disabled:opacity-35 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-fg-muted)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-page)]"
          aria-label={`Increase ${label}`}
          disabled={incDisabled}
          onClick={() => {
            clearDraft();
            onChange(strictClamp ? clamp(value + step) : value + step);
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
