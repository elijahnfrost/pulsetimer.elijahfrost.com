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
   * compact: intrinsic width, − value + in a row (default).
   * fill: fills parent width — stacked + / value / − (for equal columns, e.g. interval session row).
   */
  layout?: "compact" | "fill";
  /** Only applies when `layout` is `"fill"`. Default center. */
  labelAlign?: "center" | "start";
  /** Extra classes on the outer wrapper */
  className?: string;
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

const stepperBtnClasses =
  "flex shrink-0 items-center justify-center text-ds-muted transition-colors duration-ds " +
  "hover:bg-ds-section/45 hover:text-ds-fg active:bg-ds-section/60 disabled:opacity-35 " +
  "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[var(--color-fg-muted)] focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-[var(--color-bg-page)]";

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
  layout = "compact",
  labelAlign = "center",
  className = "",
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

  const fill = layout === "fill";

  const inputClassName =
    `bg-transparent text-center font-mono text-base text-ds-fg outline-none transition-colors duration-100 ` +
    `placeholder:text-ds-label [appearance:textfield] focus:border-transparent sm:text-lg ` +
    `[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ` +
    (fill
      ? "h-12 w-full min-w-0 shrink-0 border-0 tabular-nums"
      : "h-12 w-14 shrink-0 border-x border-ds-divider sm:w-16");

  const inputEl = (
    <input
      className={inputClassName}
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
  );

  return (
    <div
      className={[
        fill ? "flex min-w-0 w-full flex-col gap-2" : "flex flex-col items-center gap-2",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className={`text-[11px] uppercase tracking-[0.14em] text-ds-soft sm:tracking-[0.16em] ${fill ? (labelAlign === "start" ? "block w-full text-left" : "block w-full text-center") : ""}`}
      >
        {label}
      </span>

      {fill ? (
        <div className="flex min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-md border border-ds-section bg-ds-section/15 focus-within:border-ds-hover">
          <button
            type="button"
            className={`${stepperBtnClasses} min-h-12 w-full border-b border-ds-divider bg-ds-section/20`}
            aria-label={`Increase ${label}`}
            disabled={incDisabled}
            onClick={() => {
              clearDraft();
              onChange(strictClamp ? clamp(value + step) : value + step);
            }}
          >
            <span className="select-none text-[1.125rem] font-semibold leading-none text-ds-fg" aria-hidden>
              ▲
            </span>
          </button>
          {inputEl}
          <button
            type="button"
            className={`${stepperBtnClasses} min-h-12 w-full border-t border-ds-divider bg-ds-section/20`}
            aria-label={`Decrease ${label}`}
            disabled={decDisabled}
            onClick={() => {
              clearDraft();
              onChange(strictClamp ? clamp(value - step) : value - step);
            }}
          >
            <span className="select-none text-[1.125rem] font-semibold leading-none text-ds-fg" aria-hidden>
              ▼
            </span>
          </button>
        </div>
      ) : (
        <div className="flex overflow-hidden border border-ds-section bg-ds-page focus-within:border-ds-hover">
          <button
            type="button"
            className={`${stepperBtnClasses} h-12 w-11 shrink-0`}
            aria-label={`Decrease ${label}`}
            disabled={decDisabled}
            onClick={() => {
              clearDraft();
              onChange(strictClamp ? clamp(value - step) : value - step);
            }}
          >
            −
          </button>
          {inputEl}
          <button
            type="button"
            className={`${stepperBtnClasses} h-12 w-11 shrink-0`}
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
      )}
    </div>
  );
}
