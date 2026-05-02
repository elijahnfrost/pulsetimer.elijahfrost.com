"use client";

import { ReactNode } from "react";

type SectionProps = {
  children: ReactNode;
  /** Ordering hint — legacy monospace prefix; prefer {@link SetupSubStepTitle} for setup steps. */
  step?: number;
};

/** Legacy row: mono digit + uppercase label (used where chapter chrome is unnecessary). */
export function SetupSectionTitle({ step, children }: SectionProps) {
  return (
    <h2 className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-left">
      {step != null ? (
        <span className="font-mono text-[11px] font-medium tabular-nums text-ds-fg sm:text-xs">
          {step}.
        </span>
      ) : null}
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ds-fg sm:text-xs sm:tracking-[0.15em]">
        {children}
      </span>
    </h2>
  );
}

type SubProps = {
  /** Tight arabic marker (e.g. "1.") — spaced close to title text. */
  notation: string;
  children: ReactNode;
};

/** Sub-step heading: number snugs against title (narrow mono + inline flow). */
export function SetupSubStepTitle({ notation, children }: SubProps) {
  return (
    <h3 className="text-left leading-snug">
      <span className="mr-1 inline align-baseline font-mono text-[11px] font-semibold tabular-nums leading-none tracking-normal text-ds-fg sm:mr-[5px] sm:text-xs">
        {notation}
      </span>
      <span className="inline align-baseline text-[10px] font-semibold uppercase tracking-[0.14em] text-ds-fg sm:text-[11px] sm:tracking-[0.15em]">
        {children}
      </span>
    </h3>
  );
}
