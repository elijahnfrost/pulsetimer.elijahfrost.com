"use client";

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  /** Step applied to wheel deltas and buttons */
  step?: number;
  disabled?: boolean;
};

export function NumberInput({
  label,
  value,
  min,
  max,
  onChange,
  step = 1,
  disabled,
}: Props) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.2em] text-ds-soft sm:text-[10px] sm:tracking-[0.22em]">{label}</span>
      <div className="flex overflow-hidden border border-ds-section bg-ds-page focus-within:border-ds-hover">
        <button
          type="button"
          className="flex h-12 w-11 shrink-0 items-center justify-center text-ds-muted transition-colors duration-ds hover:bg-transparent hover:text-ds-fg disabled:opacity-35 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-fg-muted)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-page)]"
          aria-label={`Decrease ${label}`}
          disabled={disabled || value <= min}
          onClick={() => onChange(clamp(value - step))}
        >
          −
        </button>
        <input
          className="h-12 w-14 shrink-0 border-x border-ds-divider bg-transparent text-center font-mono text-base text-ds-fg outline-none transition-colors duration-100 placeholder:text-ds-label [appearance:textfield] focus:border-transparent sm:w-16 sm:text-lg [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          disabled={disabled}
          type="number"
          inputMode="numeric"
          aria-label={label}
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            onChange(clamp(n));
          }}
          onWheel={(e) => {
            if (disabled || document.activeElement !== e.currentTarget) return;
            e.preventDefault();
            onChange(clamp(value + (e.deltaY > 0 ? step : -step)));
          }}
        />
        <button
          type="button"
          className="flex h-12 w-11 shrink-0 items-center justify-center text-ds-muted transition-colors duration-ds hover:text-ds-fg disabled:opacity-35 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-fg-muted)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-page)]"
          aria-label={`Increase ${label}`}
          disabled={disabled || value >= max}
          onClick={() => onChange(clamp(value + step))}
        >
          +
        </button>
      </div>
    </div>
  );
}
