"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, type KeyboardEvent, type SVGProps } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center" aria-hidden />;
  }

  /* Match next-themes: resolved theme can be briefly undefined immediately after hydration. */
  const mode = resolvedTheme ?? systemTheme ?? "dark";
  const isLight = mode === "light";

  const apply = () => setTheme(isLight ? "dark" : "light");

  const onKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      apply();
    }
  };

  /* Use a focusable span — native <button> can still draw a focus ring / bezel in WebKit even with CSS resets. */
  return (
    <span
      role="button"
      tabIndex={0}
      data-theme-toggle
      onClick={apply}
      onKeyDown={onKeyDown}
      className="inline-flex h-10 w-10 shrink-0 cursor-pointer select-none items-center justify-center text-ds-soft transition-colors duration-ds hover:text-ds-fg focus-visible:text-ds-bright active:opacity-80"
      aria-label={isLight ? "Switch to dark appearance" : "Switch to light appearance"}
    >
      {isLight ? <IconMoon aria-hidden /> : <IconSun aria-hidden />}
    </span>
  );
}

function IconMoon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"
      />
    </svg>
  );
}

function IconSun(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="12" cy="12" r="3.75" strokeLinecap="round" strokeLinejoin="round" />
      <path
        strokeLinecap="round"
        d="M12 2.25v1.96M12 19.79v1.96M4.72 4.72l1.39 1.39M17.89 17.89l1.39 1.39M2.25 12h1.96M19.79 12h1.96M4.72 19.28l1.39-1.39M17.89 6.11l1.39-1.39"
      />
    </svg>
  );
}
