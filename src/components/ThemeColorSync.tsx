"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

/** Keeps Safari / PWA `theme-color` in sync after client theme resolution */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) return;
    let meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", resolvedTheme === "light" ? "#faf8f5" : "#0d0d0d");
  }, [resolvedTheme]);

  return null;
}
