"use client";

import { BigRow } from "./BigRow";
import { BigNumber } from "./BigEditors";

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
    <div className={`flex flex-col w-full min-w-0 rounded-sm overflow-hidden border border-ds-divider ${className}`}>
      <BigRow label="BEEP" borderBottom>
        <BigNumber
          label="Beeps"
          value={chimeRepeats}
          unitLabel="Beeps"
          onChange={(v) => onChimeRepeatsChange(Math.max(1, Math.min(12, v)))}
        />
      </BigRow>
      <BigRow label="VOL">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-2 text-left lg:max-w-none pl-2 pr-4 sm:pl-4 sm:pr-6">
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
      </BigRow>
    </div>
  );
}
