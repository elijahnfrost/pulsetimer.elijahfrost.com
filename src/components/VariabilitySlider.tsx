"use client";

type Props = {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
};

/** value 0–100 */
export function VariabilitySlider({ value, onChange, disabled }: Props) {
  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex justify-between text-[0.875rem] text-pulse-muted">
        <label htmlFor="variability-slider">Variability</label>
        <span aria-live="polite">{value}%</span>
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
        style={{ height: 4 }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <p className="text-[0.75rem] text-pulse-muted">
        At 0% intervals match exactly; at 100% they spread randomly while still summing correctly.
      </p>
    </div>
  );
}
