import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { READ_TO_END_MS, READ_TO_END_SHARE, useReadToEnd } from "./use-read-to-end";

/** The observers the page made, each able to say how much of its element is on screen. */
const observers: FakeObserver[] = [];

class FakeObserver {
  isWatching = false;
  readonly options: IntersectionObserverInit | undefined;
  constructor(
    private readonly callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.options = options;
    observers.push(this);
  }
  observe(): void {
    this.isWatching = true;
  }
  unobserve(): void {}
  disconnect(): void {
    this.isWatching = false;
  }
  /** The browser says this much of the element is on screen. */
  show(ratio: number): void {
    const entry = { isIntersecting: ratio > 0, intersectionRatio: ratio };
    this.callback([entry as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

function Line({ onRead }: { onRead?: () => void }) {
  const line = useRef<HTMLParagraphElement>(null);
  useReadToEnd(line, onRead);
  return <p ref={line}>Ends at 21:30</p>;
}

/** The only observer the page made. */
function observer(): FakeObserver {
  expect(observers).toHaveLength(1);
  return observers[0]!;
}

function setHidden(isHidden: boolean): void {
  Object.defineProperty(document, "visibilityState", {
    value: isHidden ? "hidden" : "visible",
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  observers.length = 0;
  Object.defineProperty(window, "IntersectionObserver", {
    value: FakeObserver,
    configurable: true,
  });
});
afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(window, "IntersectionObserver");
  Reflect.deleteProperty(document, "visibilityState");
});

describe("the day read to its end", () => {
  it("is told once the line has stayed in view for its moment, and only once", () => {
    const onRead = vi.fn();
    render(<Line onRead={onRead} />);

    act(() => observer().show(1));
    wait(READ_TO_END_MS - 1);
    expect(onRead).not.toHaveBeenCalled();
    wait(1);
    expect(onRead).toHaveBeenCalledTimes(1);

    expect(observer().isWatching).toBe(false);
    act(() => observer().show(1));
    wait(READ_TO_END_MS * 2);
    expect(onRead).toHaveBeenCalledTimes(1);
  });

  it("waits again from nothing when the line leaves the screen before its moment", () => {
    const onRead = vi.fn();
    render(<Line onRead={onRead} />);

    act(() => observer().show(1));
    wait(READ_TO_END_MS - 100);
    act(() => observer().show(0));
    wait(READ_TO_END_MS);
    expect(onRead).not.toHaveBeenCalled();

    act(() => observer().show(1));
    wait(READ_TO_END_MS - 1);
    expect(onRead).not.toHaveBeenCalled();
    wait(1);
    expect(onRead).toHaveBeenCalledTimes(1);
  });

  it("counts the line in view only once most of it is on screen", () => {
    const onRead = vi.fn();
    render(<Line onRead={onRead} />);

    expect(observer().options?.threshold).toBe(READ_TO_END_SHARE);
    act(() => observer().show(READ_TO_END_SHARE / 2));
    wait(READ_TO_END_MS * 2);
    expect(onRead).not.toHaveBeenCalled();

    act(() => observer().show(READ_TO_END_SHARE));
    wait(READ_TO_END_MS);
    expect(onRead).toHaveBeenCalledTimes(1);
  });

  it("is not told while the page is hidden, and waits again once it is back", () => {
    const onRead = vi.fn();
    render(<Line onRead={onRead} />);

    act(() => observer().show(1));
    wait(READ_TO_END_MS / 2);
    act(() => setHidden(true));
    wait(READ_TO_END_MS * 2);
    expect(onRead).not.toHaveBeenCalled();

    act(() => setHidden(false));
    wait(READ_TO_END_MS - 1);
    expect(onRead).not.toHaveBeenCalled();
    wait(1);
    expect(onRead).toHaveBeenCalledTimes(1);
  });

  it("is never told for a line gone before its moment, as when the visitor leaves the day", () => {
    const onRead = vi.fn();
    const { unmount } = render(<Line onRead={onRead} />);

    act(() => observer().show(1));
    wait(READ_TO_END_MS / 2);
    unmount();
    wait(READ_TO_END_MS * 2);

    expect(onRead).not.toHaveBeenCalled();
    expect(observer().isWatching).toBe(false);
  });

  it("tells the latest listener, without watching the line again", () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = render(<Line onRead={first} />);

    act(() => observer().show(1));
    rerender(<Line onRead={latest} />);
    wait(READ_TO_END_MS);

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
  });

  it("watches nothing with no one to tell, or in a browser that cannot say what is on screen", () => {
    render(<Line />);
    expect(observers).toEqual([]);

    Reflect.deleteProperty(window, "IntersectionObserver");
    const onRead = vi.fn();
    render(<Line onRead={onRead} />);
    wait(READ_TO_END_MS * 2);
    expect(onRead).not.toHaveBeenCalled();
  });
});
