"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

export type ControlButtonVariant = "primary" | "secondary" | "session";

type BtnProps = {
  children: ReactNode;
  variant?: ControlButtonVariant;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const primary =
  `inline-flex min-h-[48px] min-w-[7.5rem] items-center justify-center rounded-md border border-ds-fg ` +
  `bg-ds-fg px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ds-page ` +
  `transition-all duration-ds hover:opacity-90 active:opacity-95 ` +
  `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)] ` +
  `sm:min-h-[52px] sm:px-8 sm:text-[12px] sm:tracking-[0.15em]`;

const secondary =
  `inline-flex min-h-[48px] min-w-[7.5rem] items-center justify-center rounded-md border border-ds-divider ` +
  `bg-transparent px-6 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-ds-soft ` +
  `transition-all duration-ds hover:border-ds-border hover:bg-ds-section/30 hover:text-ds-fg ` +
  `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)] ` +
  `sm:min-h-[52px] sm:px-8 sm:text-[12px] sm:tracking-[0.13em]`;

/**
 * Schedule header transports: bottom hairline only (no boxed frame), same scale as Schedule title —
 * avoids wrapped uppercase blocks and aligns with divide-y rows.
 */
export const scheduleTransportBaseClass =
  `inline-flex min-h-10 min-w-0 max-w-full items-center flex-nowrap whitespace-nowrap leading-none ` +
  `border-0 border-b border-ds-divider bg-transparent py-2 pb-2 text-sm font-normal tracking-tight text-ds-fg ` +
  `transition-[border-color,background-color,opacity,color] duration-ds ` +
  `hover:border-ds-border hover:bg-ds-section/15 ` +
  `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)]`;

/** Full-width Start row (legacy — prefer {@link scheduleHeaderBarShellClass} + actions). */
const session =
  `${scheduleTransportBaseClass} w-full justify-between gap-3 px-0 sm:gap-4`;

/** Compact Pause / Resume / Stop in the schedule header — same divider language. */
export const scheduleTransportChipClass =
  `${scheduleTransportBaseClass} shrink-0 justify-center gap-2 px-2 sm:min-w-[5.75rem] sm:px-3`;

/** Narrow chip (e.g. Stop) when you want a shorter min-width than `scheduleTransportChipClass`. */
export const scheduleTransportChipCompactClass =
  `${scheduleTransportBaseClass} shrink-0 justify-center gap-1.5 px-2 sm:min-w-0 sm:px-2.5`;

/**
 * Idle + playback share this row: transports on the start edge, monospaced clock on the trailing
 * edge — only values and labels change; geometry stays put.
 */
export const scheduleHeaderBarShellClass =
  `flex min-h-[3.875rem] w-full min-w-0 flex-nowrap items-center justify-between gap-3 ` +
  `overflow-x-auto overflow-y-visible [scrollbar-width:thin] ` +
  `border-0 border-b border-ds-divider pb-3 sm:min-h-[4.125rem] sm:gap-4`;

/** Trailing session clock — reserved width so elapsed/total doesn’t jump the row. */
export const scheduleHeaderTimeClass =
  `shrink-0 min-w-[13ch] text-right font-mono text-[0.8125rem] tabular-nums leading-none tracking-tight text-ds-muted sm:text-sm`;

/** Primary header control (Start / Pause / Resume): ~48px target, no bottom border (shell handles divider). */
export const scheduleBarPrimaryActionClass =
  `inline-flex shrink-0 items-center justify-center gap-2.5 rounded-none bg-transparent ` +
  `px-4 py-3 text-base font-normal leading-none tracking-tight text-ds-fg sm:px-5 ` +
  `min-h-12 min-w-[8.5rem] whitespace-nowrap ` +
  `transition-colors duration-ds hover:bg-ds-section/25 active:bg-ds-section/35 ` +
  `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)] ` +
  `disabled:pointer-events-none disabled:opacity-40`;

export const scheduleBarSecondaryActionClass =
  `inline-flex shrink-0 items-center justify-center gap-2 rounded-none bg-transparent ` +
  `px-3 py-3 text-base font-normal leading-none tracking-tight text-ds-fg sm:px-4 ` +
  `min-h-12 min-w-[6.75rem] whitespace-nowrap ` +
  `transition-colors duration-ds hover:bg-ds-section/25 active:bg-ds-section/35 ` +
  `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)]`;

/** Shared surfaces for `ControlButton` and layout-heavy callers (split rows, full-width session CTAs). */
export function controlButtonClasses(variant: ControlButtonVariant = "primary"): string {
  if (variant === "primary") return primary;
  if (variant === "session") return session;
  return secondary;
}

/** Compact square actions — reorder arrows, trash in dense editors; pairs with focus ring used elsewhere. */
export const denseIconButtonClass =
  `inline-flex items-center justify-center rounded-md border border-ds-divider bg-transparent ` +
  `text-ds-soft transition-all duration-ds hover:border-ds-border hover:bg-ds-section/30 hover:text-ds-fg ` +
  `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)] ` +
  `disabled:pointer-events-none disabled:opacity-[0.42] active:opacity-95`;

export function ControlButton({
  variant = "primary",
  children,
  className = "",
  type = "button",
  ...rest
}: BtnProps) {
  const classes = `${controlButtonClasses(variant)} disabled:pointer-events-none disabled:opacity-[0.42]`;
  return (
    <button type={type} className={`${classes} ${className}`} {...rest}>
      {children}
    </button>
  );
}

type RowProps = {
  children: ReactNode;
  className?: string;
};

export function ControlsRow({ children, className = "" }: RowProps) {
  return (
    <div
      className={["flex flex-wrap items-center justify-center gap-3", className].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}
