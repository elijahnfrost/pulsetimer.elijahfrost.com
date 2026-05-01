"use client";

import { NumberInput } from "./NumberInput";

type Props = {
  chimeRepeats: number;
  onChimeRepeatsChange: (v: number) => void;
  chimeVolumePct: number;
  onChimeVolumeChange: (v: number) => void;
  className?: string;
};

/**
 * Beeps + volume on one row: number control keeps natural width; slider shares space with a sensible max width.
 */
export function IntervalSoundPanel({
  chimeRepeats,
  onChimeRepeatsChange,
  chimeVolumePct,
  onChimeVolumeChange,
  className = "",
}: Props) {
  return (
    <div className={`flex w-full flex-col gap-5 sm:flex-row sm:items-end sm:justify-start sm:gap-8 ${className}`}>
      <NumberInput
        className="shrink-0"
        label="Beeps"
        value={chimeRepeats}
        min={1}
        max={12}
        onChange={onChimeRepeatsChange}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-left lg:max-w-none">
        <div className="flex min-h-[1rem] flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.14em] text-ds-soft sm:tracking-[0.16em]">
          <label htmlFor="chime-volume-slider" className="shrink-0">
            Volume
          </label>
          <span className="ml-1 shrink-0 font-mono tabular-nums" aria-live="polite">
            {chimeVolumePct}%
          </span>
        </div>
        <input
          id="chime-volume-slider"
          type="range"
          min={0}
          max={100}
          step={1}
          value={chimeVolumePct}
          aria-valuetext={`${chimeVolumePct} percent`}
          className="variability-slider w-full"
          onChange={(e) => onChimeVolumeChange(Number(e.target.value))}
          onInput={(e) => onChimeVolumeChange(Number((e.target as HTMLInputElement).value))}
        />
      </div>
    </div>
  );
}
