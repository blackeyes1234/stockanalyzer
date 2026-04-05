"use client";

import { memo, useLayoutEffect } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * Next.js hydrates `<html>` with the server `className` only (fonts, etc.), which can strip
 * a `dark` class added by the inline script. Re-apply from localStorage / system before paint.
 */
export const DocumentThemeSync = memo(function DocumentThemeSync() {
  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      const dark =
        stored === "dark" ||
        (stored !== "light" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
    } catch {
      /* ignore */
    }
  }, []);

  return null;
});
