"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary";

type BtnProps = {
  children: ReactNode;
  variant?: Variant;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const primary =
  `inline-flex min-h-[44px] min-w-[7.5rem] items-center justify-center border border-ds-border ` +
  `bg-transparent px-5 py-2.5 text-[9px] font-normal uppercase tracking-[0.18em] text-ds-soft ` +
  `transition-all duration-ds hover:border-ds-hover hover:text-ds-fg ` +
  `focus-visible:border-ds-hover focus-visible:text-ds-fg ` +
  `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)] ` +
  `sm:min-h-[44px] sm:px-7 sm:text-[10px] sm:tracking-[0.2em]`;

const secondary =
  `inline-flex min-h-[44px] min-w-[7.5rem] items-center justify-center border border-ds-divider ` +
  `bg-transparent px-5 py-2.5 text-[9px] font-normal uppercase tracking-[0.18em] text-ds-dim ` +
  `transition-all duration-ds hover:border-ds-border hover:text-ds-soft ` +
  `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)] ` +
  `sm:min-h-[44px] sm:px-7 sm:text-[10px] sm:tracking-[0.18em]`;

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
};

export function ControlsRow({ children }: RowProps) {
  return <div className="flex flex-wrap items-center justify-center gap-3">{children}</div>;
}
