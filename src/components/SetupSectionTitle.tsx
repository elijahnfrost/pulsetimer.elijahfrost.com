"use client";

import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Ordering hint: 1 = broadest choice, larger = finer detail */
  step?: number;
};

/** Shared heading for interval setup bands — keeps hierarchy consistent without extra chrome. */
export function SetupSectionTitle({ step, children }: Props) {
  return (
    <h2 className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-left">
      {step != null ? (
        <span className="font-mono text-[10px] tabular-nums text-ds-soft sm:text-[11px]">{step}.</span>
      ) : null}
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ds-fg sm:text-xs sm:tracking-[0.15em]">
        {children}
      </span>
    </h2>
  );
}
