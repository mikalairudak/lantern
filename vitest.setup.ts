import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

// Testing Library only registers its own cleanup when `afterEach` is a global,
// and this config keeps globals off, so the DOM would leak between tests.
afterEach(cleanup);

// `findBy` and `waitFor` give up after 1 s by default. An element that shows within a few
// frames alone took longer than that while other sessions' hooks ran beside this one; a
// missing element still fails, at 4 s rather than 1.
const ASYNC_UTIL_TIMEOUT_MS = 4_000;
configure({ asyncUtilTimeout: ASYNC_UTIL_TIMEOUT_MS });

// The page's head script notes the day's view on `<html>` before anything renders: the
// chart, unless the visitor chose the list (`view-choice.ts`). Tests render no head, so
// each starts as a page does, on the chart; one about the list says so.
beforeEach(() => {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-day-view", "chart");
  }
});

// Each test is a first visit: a day one test played to its end is seen in this browser's
// storage, and the next would have it whole, with nothing played (`seen-days.ts`).
beforeEach(() => {
  if (typeof localStorage !== "undefined") localStorage.clear();
});
