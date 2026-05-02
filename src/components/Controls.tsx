"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

export type ControlButtonVariant = "primary" | "secondary";

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

/** Shared surfaces for `ControlButton` and layout-heavy callers (split rows, full-width session CTAs). */
export function controlButtonClasses(variant: ControlButtonVariant = "primary"): string {
  return variant === "primary" ? primary : secondary;
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
