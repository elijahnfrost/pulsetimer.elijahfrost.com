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
    <div className="flex flex-col gap-1 items-center">
      <span className="text-[0.875rem] text-pulse-muted">{label}</span>
      <div className="flex rounded-full border border-pulse-border overflow-hidden focus-within:shadow-accent-glow">
        <button
          type="button"
          className="w-11 h-12 text-pulse-accent hover:bg-pulse-border/60 transition-colors focus-visible:z-10 focus-visible:focus-ring"
          aria-label={`Decrease ${label}`}
          disabled={disabled || value <= min}
          onClick={() => onChange(clamp(value - step))}
        >
          −
        </button>
        <input
          className="w-14 sm:w-16 h-12 bg-transparent text-center font-mono text-lg text-pulse-text outline-none border-x border-pulse-border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
          className="w-11 h-12 text-pulse-accent hover:bg-pulse-border/60 transition-colors focus-visible:z-10 focus-visible:focus-ring"
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
