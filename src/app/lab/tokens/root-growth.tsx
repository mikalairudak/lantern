"use client";

import { useSyncExternalStore } from "react";
import { subscribeToResize, useRootFontPx, useRootGrowth } from "@/components/ui/use-root-font-px";
import { ROOT_TOKENS, type RootToken } from "@/lib/tokens/catalog";
import { DEFAULT_ROOT_PX } from "@/lib/tokens/root";

/** One root token's value as the stylesheet sets it, or null before the page is drawn. */
function useRootToken(name: RootToken): number | null {
  return useSyncExternalStore(
    subscribeToResize,
    () =>
      Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(`--root-${name}`),
      ),
    () => null,
  );
}

/** The viewport's width as `vw` counts it, its scrollbar included. */
function useViewportWidth(): number | null {
  return useSyncExternalStore(
    subscribeToResize,
    () => window.innerWidth,
    () => null,
  );
}

/** How a token reads at the browser's default size: a width in pixels, or a factor. */
function inPixelsOf(name: RootToken, value: number): string {
  return name === "grows-by" ? `× ${value}` : `${value} rem · ${value * DEFAULT_ROOT_PX} px`;
}

/**
 * The root tokens with their values, and the root's size and the chart's drawing factor at
 * this window's width, so resizing the window shows the page grow.
 */
export function RootGrowth() {
  const rootPx = useRootFontPx();
  const growth = useRootGrowth();
  const viewport = useViewportWidth();
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col">
        {ROOT_TOKENS.map(({ name, role }) => (
          <RootTokenRow key={name} name={name} role={role} />
        ))}
      </ul>
      <p className="text-small text-muted" data-root-now>
        {rootPx === null || viewport === null
          ? "Measuring the root…"
          : `At ${viewport} px wide the root is ${Number(rootPx.toFixed(2))} px, and the chart is drawn × ${growth.toFixed(3)}.`}
      </p>
    </div>
  );
}

function RootTokenRow({ name, role }: { name: RootToken; role: string }) {
  const value = useRootToken(name);
  return (
    <li className="flex flex-col gap-2 border-b border-line py-4 md:flex-row md:items-baseline md:gap-8">
      <span className="flex w-label shrink-0 flex-col">
        <span className="text-meta">{name}</span>
        <span className="text-small text-muted">{role}</span>
      </span>
      <span className="text-body tabular-nums">
        {value === null ? "…" : inPixelsOf(name, value)}
      </span>
    </li>
  );
}
