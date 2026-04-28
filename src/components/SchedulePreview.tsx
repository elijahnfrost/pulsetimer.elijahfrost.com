"use client";

import { formatMmSs } from "@/lib/formatTime";

type Props = {
  intervalsMs: number[];
};

export function SchedulePreview({ intervalsMs }: Props) {
  const total = intervalsMs.reduce((a, b) => a + b, 0);

  return (
    <details className="mx-auto w-full border border-ds-section bg-ds-page px-4 py-3 text-center">
      <summary className="flex list-none cursor-pointer flex-col items-center gap-2 text-center text-sm leading-snug font-normal text-ds-fg hover:text-ds-bright sm:flex-row sm:justify-between sm:gap-4 sm:text-left [&::-webkit-details-marker]:hidden [&::marker]:content-none">
        <span>Schedule ({intervalsMs.length} rings)</span>
        <span className="shrink-0 font-mono text-xs text-ds-muted tabular-nums">{formatMmSs(total)} total</span>
      </summary>
      <ul className="mx-auto mt-4 max-h-48 max-w-lg space-y-0 overflow-y-auto pr-1 text-sm text-ds-body">
        {intervalsMs.map((ms, i) => (
          <li
            key={`${i}-${ms}`}
            className="flex justify-center gap-4 border-b border-ds-divider py-2 last:border-b-0 sm:justify-between"
          >
            <span className="text-ds-muted">Ring {i + 1}</span>
            <span className="font-mono text-ds-fg tabular-nums">{formatMmSs(ms)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
