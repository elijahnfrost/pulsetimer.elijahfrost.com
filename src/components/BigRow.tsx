"use client";

import type { ReactNode } from "react";
import { letterGradient, phaseRailMaskStyle, rowShellBase } from "./BigEditors";

type Props = {
  label: string;
  children: ReactNode;
  rightAction?: ReactNode;
  borderBottom?: boolean;
  onClick?: () => void;
  isActive?: boolean;
};

export function BigRow({ label, children, rightAction, borderBottom = false, onClick, isActive }: Props) {
  const isMulti = label.length > 1;

  const psClass = isMulti
    ? "ps-[9.5rem] sm:ps-[11rem]"
    : "ps-[calc(6.5rem+0.125rem)] sm:ps-[calc(7.75rem+0.25rem)]";
  
  const widthClass = isMulti
    ? "w-[9.5rem] sm:w-[11rem]"
    : "w-[6.5rem] sm:w-[7.75rem]";
    
  const fontSizeClass = isMulti
    ? "text-[3.5rem] sm:text-[4.25rem]"
    : "text-[length:calc(6.5rem-0.72rem)] sm:text-[length:calc(7.75rem-0.82rem)]";

  const Component = onClick ? "button" : "div";
  const interactiveClasses = onClick
    ? `w-full text-left transition-colors duration-ds hover:bg-ds-section/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg-muted)] ${isActive ? "bg-ds-section/20" : ""}`
    : "";

  return (
    <Component
      onClick={onClick}
      type={onClick ? "button" : undefined}
      className={`${rowShellBase} ${psClass} ${interactiveClasses} ${borderBottom ? "border-b border-ds-divider" : ""}`}
    >
      <div
        className={`pointer-events-none absolute inset-y-0 start-0 z-0 ${widthClass} opacity-[0.92] transition-opacity duration-300 ease-out group-hover:opacity-100`}
        aria-hidden
      >
        <div
          className="h-full w-full bg-gradient-to-r from-ds-section/60 via-ds-section/35 to-transparent"
          style={phaseRailMaskStyle}
        />
      </div>

      <span
        className={`absolute inset-y-0 start-0 z-[1] flex ${widthClass} -translate-x-3 sm:-translate-x-4 items-center justify-start ${letterGradient} bg-clip-text ps-0 font-sans ${fontSizeClass} font-[100] tabular-nums leading-none tracking-[-0.06em] text-transparent antialiased [font-feature-settings:'kern'_1,'liga'_1] [text-rendering:geometricPrecision]`}
        aria-label={label}
      >
        {label}
      </span>

      <div className="relative z-10 flex min-w-0 flex-1 justify-center sm:justify-start">
        {children}
      </div>

      {rightAction && (
        <div className="relative z-10 flex shrink-0 items-center gap-1 sm:gap-1.5">
          {rightAction}
        </div>
      )}
    </Component>
  );
}
