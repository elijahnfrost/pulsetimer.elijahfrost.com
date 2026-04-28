"use client";

import { formatMmSs } from "@/lib/formatTime";

type Props = {
  intervalsMs: number[];
  collapsedDefault?: boolean;
};

export function SchedulePreview({ intervalsMs }: Props) {
  const total = intervalsMs.reduce((a, b) => a + b, 0);

  return (
    <details className="rounded-xl border border-pulse-border bg-pulse-surface/50 px-4 py-3 text-left">
      <summary className="cursor-pointer select-none text-sm font-medium text-pulse-text list-none flex justify-between gap-4">
        <span>Schedule preview ({intervalsMs.length} rings)</span>
        <span className="text-pulse-muted">{formatMmSs(total)} total</span>
      </summary>
      <ul className="mt-4 max-h-48 overflow-y-auto space-y-1 pr-2 text-sm text-pulse-muted">
        {intervalsMs.map((ms, i) => (
          <li key={`${i}-${ms}`} className="flex justify-between border-b border-pulse-border/50 pb-1 last:border-b-0">
            <span>Ring {i + 1}</span>
            <span className="font-mono text-pulse-text">{formatMmSs(ms)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
