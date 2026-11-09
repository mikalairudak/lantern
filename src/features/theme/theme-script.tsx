"use client";

import { useLayoutEffect } from "react";
import { InlineScript } from "@/components/ui/inline-script";
import { THEME_SCRIPT, restoreThemeChoice } from "./theme";

/**
 * The visitor's theme on `<html>` before the first paint: the head script, as the page's
 * HTML is parsed, and once React has drawn the page, the same choice wherever the script
 * did not run, as on a page React drew in the browser, where no script it draws runs.
 */
export function ThemeScript() {
  useLayoutEffect(() => restoreThemeChoice(), []);
  return <InlineScript html={THEME_SCRIPT} />;
}
