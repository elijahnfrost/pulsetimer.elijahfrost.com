"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary";

type BtnProps = {
  children: ReactNode;
  variant?: Variant;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

function btnClass(variant: Variant, className = ""): string {
  const base =
    "min-w-[120px] h-12 px-5 rounded-full text-sm font-medium transition-all duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-pulse-accent focus-visible:ring-offset-2 focus-visible:ring-offset-pulse-bg active:scale-[0.97] active:duration-100 ";
  const v =
    variant === "primary"
      ? "bg-pulse-accent text-white hover:brightness-[1.1]"
      : "bg-transparent border border-pulse-accent text-pulse-accent hover:brightness-[1.1]";
  return `${base}${v} ${className}`;
}

export function ControlButton({
  variant = "primary",
  children,
  className = "",
  type = "button",
  ...rest
}: BtnProps) {
  return (
    <button type={type} className={btnClass(variant, className)} {...rest}>
      {children}
    </button>
  );
}

type RowProps = {
  children: ReactNode;
};

export function ControlsRow({ children }: RowProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">{children}</div>
  );
}
