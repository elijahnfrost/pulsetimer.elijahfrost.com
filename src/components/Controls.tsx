"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary";

type BtnProps = {
  children: ReactNode;
  variant?: Variant;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const primary =
  `inline-flex min-h-[44px] min-w-[7.5rem] items-center justify-center rounded-md border border-ds-fg ` +
  `bg-ds-fg px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-ds-page ` +
  `transition-all duration-ds hover:opacity-90 active:opacity-95 ` +
  `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)] ` +
  `sm:min-h-[44px] sm:px-7 sm:text-[11px] sm:tracking-[0.14em]`;

const secondary =
  `inline-flex min-h-[44px] min-w-[7.5rem] items-center justify-center rounded-md border border-ds-divider ` +
  `bg-transparent px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ds-soft ` +
  `transition-all duration-ds hover:border-ds-border hover:bg-ds-section/30 hover:text-ds-fg ` +
  `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)] ` +
  `sm:min-h-[44px] sm:px-7 sm:text-[11px] sm:tracking-[0.12em]`;

function btnClass(variant: Variant): string {
  return variant === "primary" ? primary : secondary;
}

export function ControlButton({
  variant = "primary",
  children,
  className = "",
  type = "button",
  ...rest
}: BtnProps) {
  const classes = `${btnClass(variant)} disabled:pointer-events-none disabled:opacity-[0.42]`;
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
