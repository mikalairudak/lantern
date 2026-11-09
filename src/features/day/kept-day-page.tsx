"use client";

import { useEffect, useRef, useState } from "react";
import { useHydrated } from "@/components/ui/use-hydrated";
import type { StoredDay } from "@/lib/days/stored-day";
import { Day } from "./day";
import { pageTitleOf } from "./day-title";
import { KEPT_POLL_MS, KEPT_WAIT_MS, askKeptDay, keptViewOf, restatedYourDayOf } from "./kept-day";
import { NO_DAY_TITLE, NoDayHere, StillWritingHere } from "./no-day-here";
import { restateDay, useYourDays } from "./use-your-days";

export interface KeptDayPageProps {
  /** The day's id in the log, which its address holds. */
  id: string;
  /** How the log answered for it as the page was drawn. */
  stored: StoredDay;
  /** Live generation is on, as the server read it: a day here can be written again. */
  isLive: boolean;
}

/**
 * A day kept on the server, at its own address (`docs/decisions.md`, "A day is written to its end,
 * and kept to be opened again"): drawn whole as it ended, or what stands in its place. A day whose
 * record has not landed is still being written, so the page asks for it again every few seconds,
 * and takes it once it lands, until the day route's longest run is over: counted from when this
 * browser asked it, or from the first look here. The visitor's own record of the day, when this
 * browser asked it, is told how it stands.
 */
export function KeptDayPage({ id, stored: first, isLive }: KeptDayPageProps) {
  const [stored, setStored] = useState(first);
  const asked = useYourDays().find((day) => day.id === id) ?? null;
  const askedAt = asked === null ? null : Date.parse(asked.startedAt);
  // The first look here, read in the browser: a page drawn on the server reads no clock.
  const lookedAt = useRef<number | null>(null);
  const [isOverdue, setIsOverdue] = useState(false);
  const isUnknown = stored.status === "unknown";
  const isWaiting = isUnknown && !isOverdue;
  // Whether this browser asked a day still being written is known only once its list is
  // read: until then a page for one says nothing, rather than a stranger's headline first.
  const isHydrated = useHydrated();

  useEffect(() => {
    if (!isUnknown) return undefined;
    lookedAt.current ??= Date.now();
    const since = askedAt ?? lookedAt.current;
    const timer = window.setTimeout(
      () => setIsOverdue(true),
      Math.max(0, since + KEPT_WAIT_MS - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [isUnknown, askedAt]);

  useEffect(() => {
    if (!isWaiting) return undefined;
    const controller = new AbortController();
    let timer: number | undefined;
    const askLater = () => {
      timer = window.setTimeout(() => {
        void askKeptDay(id, controller.signal).then((answer) => {
          if (controller.signal.aborted) return;
          // A record that has not landed, or a read that failed, is asked for again.
          if (answer === null || answer.status === "unknown") askLater();
          else setStored(answer);
        });
      }, KEPT_POLL_MS);
    };
    askLater();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [id, isWaiting]);

  useEffect(() => {
    if (asked === null) return;
    const restated = restatedYourDayOf(asked, stored, isOverdue);
    if (JSON.stringify(restated) !== JSON.stringify(asked)) restateDay(restated);
  }, [asked, stored, isOverdue]);

  const view = keptViewOf(id, stored, asked, isOverdue);
  // The page's own title for no day, once the wait for one is over.
  useEffect(() => {
    if (view.kind === "none") document.title = pageTitleOf(NO_DAY_TITLE);
  }, [view.kind]);
  if (isUnknown && !isHydrated) return null;
  if (view.kind === "writing") return <StillWritingHere />;
  if (view.kind === "none") return <NoDayHere />;
  return <Day kept={view.landing} isLive={isLive} isAddressed isCounted />;
}
