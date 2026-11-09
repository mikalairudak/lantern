"use client";

import { MotionConfig, motion } from "motion/react";
import { useState } from "react";
import { SPRINGS, type SpringName } from "@/lib/tokens/motion";

const SPRING_NAMES = Object.keys(SPRINGS) as SpringName[];

/** Moves one marker per spring across the same distance, so their feel can be compared. */
export function MotionDemo() {
  const [isAtEnd, setIsAtEnd] = useState(false);

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-6">
        <ul className="flex flex-col gap-4">
          {SPRING_NAMES.map((name) => {
            const { visualDuration, bounce } = SPRINGS[name];
            return (
              <li key={name} className="flex flex-col gap-2 md:flex-row md:items-center md:gap-8">
                <span className="flex w-label shrink-0 flex-col">
                  <span className="text-meta">{name}</span>
                  <span className="text-small text-muted">
                    {visualDuration}s, bounce {bounce}
                  </span>
                </span>
                <div
                  className={`flex h-8 flex-1 items-center border-b border-line ${isAtEnd ? "justify-end" : "justify-start"}`}
                >
                  <motion.span
                    layout
                    data-spring={name}
                    transition={SPRINGS[name]}
                    className="size-4 rounded-full bg-energy"
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => setIsAtEnd((current) => !current)}
            className="rounded-sm border border-line px-4 py-2 text-meta tracking-caps uppercase transition-colors hover:bg-surface"
          >
            {isAtEnd ? "Rewind" : "Play"}
          </button>
          {/* A media query, not client state: the server cannot know the setting. */}
          <p className="hidden text-small text-muted motion-reduce:block">
            Reduced motion is on, so the markers jump instead of moving.
          </p>
        </div>
      </div>
    </MotionConfig>
  );
}
