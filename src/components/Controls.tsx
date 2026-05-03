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
const session = `${scheduleTransportBaseClass} w-full justify-between gap-3 px-0 sm:gap-4`;

/** Compact Pause / Resume / Stop in the schedule header — same divider language. */
export const scheduleTransportChipClass = `${scheduleTransportBaseClass} shrink-0 justify-center gap-2 px-2 sm:min-w-[5.75rem] sm:px-3`;

/** Narrow chip (e.g. Stop) when you want a shorter min-width than `scheduleTransportChipClass`. */
export const scheduleTransportChipCompactClass = `${scheduleTransportBaseClass} shrink-0 justify-center gap-1.5 px-2 sm:min-w-0 sm:px-2.5`;

/**
 * Shared transport shell for setup + playback. Three fixed slots keep geometry stable:
 * primary action, stop slot (reserved in setup), and trailing session clock.
 */
export const scheduleTransportBarShellClass =
  `grid w-full min-w-0 grid-cols-[6.25rem_4.75rem_minmax(11ch,1fr)] items-center gap-1.5 border-b border-ds-divider pb-2.5 ` +
  `sm:grid-cols-[6.5rem_5rem_minmax(13ch,1fr)]`;

/** Monospaced session clock slot with reserved width to avoid elapsed/total shifts. */
export const scheduleTransportTimeClass = `justify-self-end ps-2 text-right font-mono text-[0.8125rem] tabular-nums leading-none tracking-tight text-ds-muted sm:text-sm`;

/** Back-compat aliases (existing callers can keep imports while sharing one transport geometry). */
export const scheduleHeaderBarShellClass = scheduleTransportBarShellClass;
export const schedulePlaybackHeaderShellClass = scheduleTransportBarShellClass;
export const scheduleHeaderTimeClass = scheduleTransportTimeClass;
export const schedulePlaybackTimeRowClass = scheduleTransportTimeClass;

/** Primary header control (Start / Pause / Resume): filled pill reads as main CTA vs body copy / ring rows. */
export const scheduleBarPrimaryActionClass =
  `inline-flex min-h-[38px] w-full shrink-0 items-center justify-center gap-1.5 rounded ` +
  `border border-ds-fg/12 bg-ds-fg px-2.5 py-1.5 text-sm font-medium leading-none text-ds-page ` +
  `whitespace-nowrap transition-[background-color,opacity,border-color] duration-ds ` +
  `hover:opacity-95 active:opacity-90 ` +
  `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)] ` +
  `disabled:pointer-events-none disabled:opacity-40`;

export const scheduleBarSecondaryActionClass =
  `inline-flex min-h-[38px] w-full shrink-0 items-center justify-center gap-1.5 rounded ` +
  `border border-ds-divider bg-transparent px-2.5 py-1.5 text-sm font-medium leading-none text-ds-soft ` +
  `whitespace-nowrap transition-[background-color,border-color,color,opacity] duration-ds ` +
  `hover:border-ds-border hover:bg-ds-section/20 hover:text-ds-fg active:opacity-90 ` +
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
      className={["flex flex-wrap items-center justify-center gap-3", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
