"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/components/ui/cn";
import { ICON_SIZES, ICON_STROKE_WIDTH } from "@/lib/tokens/icon";
import { LIST_ROW_CLASSES, LIST_SHEET_CLASSES, ROW_NOTE_CLASSES } from "./word-list";

/** What the day menu's button says. */
export const TAKE_THIS_DAY = "Take this day";

export interface DayMenuItem {
  key: string;
  label: string;
  /** What it does, in plain words, under its label. */
  note: string;
  onSelect?: () => void;
  /** Opens a page of its own, as the walking route does, in a new tab. */
  href?: string;
  /** Not yet: shown, so the visitor learns it is there, and said to be waiting. */
  isDisabled?: boolean;
  /** The menu stays open once it is chosen, so the item's own words can say how it went. */
  keepsOpen?: boolean;
  /** Set apart from the items above it by a rule. */
  isApart?: boolean;
  /** Chosen, it moves the focus itself, as "Plan another day" opens the city's field. */
  movesFocus?: boolean;
  /**
   * Locked for now, as "Plan another day" is while a re-plan is written: drawn as waiting and
   * marked so, but chosen it still runs, to say why it is locked.
   */
  isLocked?: boolean;
  /** What a screen reader hears once it is chosen, as "The day's link is copied". */
  status?: string;
}

/**
 * An item is a list's row, edge to edge on the list's sheet (`docs/decisions.md`, "A corner is
 * 2 px or a circle"). Pointed at, it sits on the page's ground and its name takes the ink rule,
 * as any word that can be pressed does; a disabled or locked one shows neither.
 */
const ITEM_CLASSES = cn(
  LIST_ROW_CLASSES,
  "group/pointed focus-ring-inset not-aria-disabled:pointed:bg-ground aria-disabled:cursor-default",
);

/** The menu: the lists' sheet, hung from the foot of the masthead's row. */
const MENU_CLASSES = cn(
  "absolute top-full right-0 z-30 mt-1 flex w-full max-w-intro flex-col py-1 text-left whitespace-normal",
  LIST_SHEET_CLASSES,
);

/** The item's name under the pointer or the keyboard's focus: the ink hairline under it. */
const ITEM_NAME_POINTED_CLASSES =
  "decoration-ink decoration-1 underline-offset-4 pointed-group:underline";

/**
 * The day's menu in the masthead: one button, "Take this day", framed as the masthead's one
 * control, that holds the ways to take the day along and "Plan another day", each saying in a
 * line under it what it does (`docs/decisions.md`, "The day's ways along live in one menu, in
 * the masthead").
 *
 * A menu button and a menu: Enter, Space or the down arrow opens it on its first item, the up
 * arrow on its last, and a press opens it with the focus left on the button, which the arrows
 * then take into it; the arrows, Home and End move through it; Escape closes it and gives the
 * focus back to the button; Tab or a press outside closes it.
 */
export function DayMenu({
  items,
  isOpenAtFirst = false,
  pointedKey = null,
  onOpen,
}: {
  items: readonly DayMenuItem[];
  /** Drawn open from the first frame, as a lab cell draws it, taking no focus. */
  isOpenAtFirst?: boolean;
  /** The item drawn pointed at with no pointer, as a lab cell draws it. */
  pointedKey?: string | null;
  /** Told each time the visitor opens the menu; not for a menu drawn open from the first frame. */
  onOpen?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(isOpenAtFirst);
  const menuId = useId();
  const buttonId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const firstFocus = useRef<"first" | "last" | null>(isOpenAtFirst ? null : "first");

  useEffect(() => {
    if (!isOpen) return undefined;
    const list = itemsIn(menuRef.current);
    if (firstFocus.current !== null) {
      (firstFocus.current === "first" ? list[0] : list.at(-1))?.focus();
    }
    const onOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [isOpen]);

  /** Opens the menu; from the keyboard on an item, from a press with the focus left on the button. */
  const open = (focus: "first" | "last" | null) => {
    firstFocus.current = focus;
    setIsOpen(true);
    onOpen?.();
  };

  const close = () => {
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  const onButtonKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (isOpen && event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const focus = event.key === "ArrowDown" ? "first" : "last";
    // Open from a press, the arrows take the focus into it.
    if (isOpen) {
      const list = itemsIn(menuRef.current);
      (focus === "first" ? list[0] : list.at(-1))?.focus();
    } else {
      open(focus);
    }
  };

  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      setIsOpen(false);
      return;
    }
    const list = itemsIn(menuRef.current);
    const at = list.indexOf(document.activeElement as HTMLElement);
    const next: Record<string, HTMLElement | undefined> = {
      ArrowDown: list[(at + 1) % list.length],
      ArrowUp: list[(at - 1 + list.length) % list.length],
      Home: list[0],
      End: list.at(-1),
    };
    if (event.key === "Escape") close();
    else if (event.key in next) next[event.key]?.focus();
    else return;
    event.preventDefault();
  };

  const choose = (item: DayMenuItem) => {
    if (item.isDisabled) return;
    item.onSelect?.();
    if (item.keepsOpen) return;
    // The focus goes back to the button, unless the item has sent it somewhere on purpose.
    if (item.movesFocus) setIsOpen(false);
    else close();
  };

  const status = items.find((item) => item.status)?.status ?? "";
  return (
    // The menu hangs from the masthead's row, which stands it inside the page's gutters at any
    // width: from the button alone, at 360 px it ran 25 px off the screen's left edge.
    <span
      className="inline-flex shrink-0"
      // The focus leaving the button and its menu, by Tab or otherwise, closes it.
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOpen(false);
      }}
    >
      <span role="status" className="sr-only">
        {status}
      </span>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        // A click from the keyboard, Enter or Space, has no detail: it opens on the first item.
        onClick={(event) => (isOpen ? setIsOpen(false) : open(event.detail === 0 ? "first" : null))}
        onKeyDown={onButtonKey}
        className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-sm border border-line px-2 whitespace-nowrap text-ink focus-ring transition-colors aria-expanded:border-ink pointed:border-ink"
      >
        {TAKE_THIS_DAY}
        <ChevronDown
          aria-hidden
          size={ICON_SIZES.xs}
          strokeWidth={ICON_STROKE_WIDTH}
          className="text-muted"
        />
      </button>
      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-labelledby={buttonId}
          onKeyDown={onMenuKey}
          className={MENU_CLASSES}
        >
          {items.map((item) => (
            <div key={item.key} className={cn(item.isApart && "mt-1 border-t border-line pt-1")}>
              {item.href && !item.isDisabled ? (
                <a
                  role="menuitem"
                  tabIndex={-1}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => choose(item)}
                  data-pointed={item.key === pointedKey || undefined}
                  className={ITEM_CLASSES}
                >
                  <ItemWords item={item} />
                </a>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  aria-disabled={item.isDisabled || item.isLocked || undefined}
                  onClick={() => choose(item)}
                  data-pointed={item.key === pointedKey || undefined}
                  className={ITEM_CLASSES}
                >
                  <ItemWords item={item} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

/** An item's name and, under it with no gap, its note, as a list's row sets them. */
function ItemWords({ item }: { item: DayMenuItem }) {
  return (
    <span className="block min-w-0 flex-1">
      <span
        className={cn(
          "block text-body",
          item.isDisabled || item.isLocked
            ? "text-muted"
            : cn("text-ink", ITEM_NAME_POINTED_CLASSES),
        )}
      >
        {item.label}
      </span>
      <span className={ROW_NOTE_CLASSES}>{item.note}</span>
    </span>
  );
}

function itemsIn(menu: HTMLElement | null): HTMLElement[] {
  return [...(menu?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
}
