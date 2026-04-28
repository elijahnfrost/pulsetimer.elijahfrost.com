"use client";

type Props = {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
};

/** value 0–100 */
export function VariabilitySlider({ value, onChange, disabled }: Props) {
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex min-h-[1rem] flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.18em] text-ds-soft sm:tracking-[0.2em]">
        <label htmlFor="variability-slider" className="shrink-0">
          Variability{" "}
        </label>
        <span aria-live="polite" className="shrink-0 font-mono tabular-nums">
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
        onChange={(e) => onChange(Number(e.target.value))}
        onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
      />
      <p className="text-xs leading-relaxed text-ds-muted sm:text-sm">
        At 0% intervals match exactly; at 100% they spread randomly while still summing correctly.
      </p>
    </div>
  );
}
