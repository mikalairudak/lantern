"use client";

import { Moon, Sun, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { LIST_SHEET_CLASSES } from "@/features/day/word-list";
import { ICON_SIZES, ICON_STROKE_WIDTH } from "@/lib/tokens/icon";
import {
  applyThemeChoice,
  currentThemeChoice,
  nextThemeChoice,
  shownLookOf,
  subscribeThemeChoice,
  type ThemeLook,
} from "./theme";

/**
 * What the button offers on a page in each look: the other one. Its icon, its helper's one word
 * and its name all say what a press gives, so a day page shows a moon and "Dark" (`docs/
 * decisions.md`, "The theme is one button that turns the page to the other look").
 */
const OFFERS: Readonly<
  Record<ThemeLook, { icon: LucideIcon; iconName: string; word: string; name: string }>
> = {
  light: { icon: Moon, iconName: "moon", word: "Dark", name: "Switch to dark theme" },
  dark: { icon: Sun, iconName: "sun", word: "Light", name: "Switch to light theme" },
};

const LOOKS: readonly ThemeLook[] = ["light", "dark"];

/** What the status says once a press has set a look, read from the look the page then shows. */
export const LOOK_STATUS: Readonly<Record<ThemeLook, string>> = {
  light: "The page is light",
  dark: "The page is dark",
};

/**
 * Each look's icon, word and name, shown only while the page stands in that look
 * (`page-day`, `page-night` in `globals.css`). The server cannot know the look, so its page
 * carries both, and the head script's note on `<html>`, with the device's scheme, picks one
 * before the first paint: the server's page and the first frame agree.
 */
const SHOWN_ON_CLASSES: Readonly<Record<ThemeLook, string>> = {
  light: "hidden page-day:inline",
  dark: "hidden page-night:inline",
};

/**
 * The box round the button and its helper: the button's 32 px box, pulled out by its margins
 * so the icon's edge is the masthead's and the line keeps its height. The helper hangs from it.
 */
const BOX_CLASSES = "relative -my-2 -mr-2 inline-flex";

/**
 * An icon as a button of its own kind, not a word: no underline, soft ink that turns ink under
 * the pointer. Under a finger its reach is 6 px past its box on every side, 44 px in all.
 */
const BUTTON_CLASSES =
  "peer relative flex size-8 items-center justify-center rounded-sm text-ink-soft transition-colors pointed:text-ink focus-ring-inset pointer-coarse:after:absolute pointer-coarse:after:-inset-1.5";

/** The keyboard's ring drawn still, as a lab cell shows the focus: `focus-ring-inset`'s. */
const FOCUS_DRAWN_CLASSES = "outline-2 -outline-offset-2 outline-ink";

/**
 * The helper: the icon's one word on a small raised sheet, 4 px under the button's box. Centred
 * on the box where the page's gutter has room for it; on a phone's gutter its right edge stands
 * on the box's, 8 px inside the window's. A strip over it bridges the 4 px, so the pointer can
 * move onto it and it stays.
 */
const HELPER_CLASSES = cn(
  LIST_SHEET_CLASSES,
  "pointer-events-none absolute top-full right-0 z-30 mt-1 px-2 py-1 type-note whitespace-nowrap text-ink-soft opacity-0 helper-fade",
  "before:absolute before:inset-x-0 before:bottom-full before:h-1",
);
/**
 * Shown after the helper's wait under a pointer that can hover, at once by the keyboard's
 * focus, and kept while the pointer is on it. Hidden, it waits for nothing.
 */
const HELPER_SHOWN_CLASSES =
  "peer-hover:pointer-events-auto peer-hover:opacity-100 peer-hover:helper-wait hover:pointer-events-auto hover:opacity-100 peer-focus-visible:pointer-events-auto peer-focus-visible:opacity-100";
/** Centred under the button, where the page's gutter, from a laptop's width, has room for it. */
const HELPER_CENTRED_CLASSES = "md:right-auto md:left-1/2 md:-translate-x-1/2";
/** The helper drawn shown, as a lab cell draws it. */
const HELPER_DRAWN_CLASSES = "pointer-events-auto opacity-100";

/**
 * What put the helper away: a pointer's press, until the pointer leaves the button's box, or the
 * keys, a press or Escape, until the focus leaves the button. Moved, not left, since the browser
 * also says a pointer left when what is under it changes, as when the theme's crossing lays its
 * pictures over the page.
 */
type HelperAway = "pointer" | "keys" | null;

/** Whether a pointer stands outside a box. */
function isOutside({ clientX, clientY }: PointerEvent, box: Element): boolean {
  const { left, right, top, bottom } = box.getBoundingClientRect();
  return clientX < left || clientX >= right || clientY < top || clientY >= bottom;
}

export interface ThemeButtonProps {
  /** Called with the look the page will show once a press has set it. */
  onPress: () => ThemeLook;
  /**
   * The look drawn from the prop rather than from what `<html>` notes, as a lab cell draws the
   * look of its own theme. The page itself draws from `<html>`.
   */
  drawnLook?: ThemeLook;
  /** The helper drawn as a pointer or the keyboard's focus shows it, as a lab cell does. */
  isHelperDrawn?: boolean;
  /** The keyboard's ring drawn, as a lab cell does. */
  isFocusDrawn?: boolean;
  /** Drawn as a pointer points at it, its icon in ink. */
  isPointedDrawn?: boolean;
  /** Drawn in a phone's gutter whatever the window's width, as a lab's phone cell is. */
  isPhoneDrawn?: boolean;
}

/**
 * The theme in the masthead: one button that turns the page to the other look. A moon on a day
 * page, a sun on a night page; every press changes the page, and the next press turns it back.
 * Its helper, under a pointer or the keyboard's focus, says the look a press gives in one word;
 * a press hides it until the pointer leaves and comes back, or the focus does, and Escape hides
 * it. No list opens. The button takes no `aria-pressed`, since its name changes with what it
 * gives, and after a press a status says the look the page then shows.
 */
export function ThemeButton({
  onPress,
  drawnLook,
  isHelperDrawn = false,
  isFocusDrawn = false,
  isPointedDrawn = false,
  isPhoneDrawn = false,
}: ThemeButtonProps) {
  const [helperAway, setHelperAway] = useState<HelperAway>(null);
  const [status, setStatus] = useState("");
  const box = useRef<HTMLSpanElement>(null);

  // Put away by a pointer's press, the helper comes back once the pointer has left the box.
  useEffect(() => {
    if (helperAway !== "pointer") return;
    const onMove = (event: PointerEvent) => {
      if (box.current && isOutside(event, box.current)) setHelperAway(null);
    };
    document.addEventListener("pointermove", onMove);
    return () => document.removeEventListener("pointermove", onMove);
  }, [helperAway]);
  const looks = drawnLook ? [drawnLook] : LOOKS;
  const shownOnClassesOf = (look: ThemeLook) => (drawnLook ? undefined : SHOWN_ON_CLASSES[look]);

  return (
    <span ref={box} className={BOX_CLASSES}>
      <button
        type="button"
        data-pointed={isPointedDrawn || undefined}
        onClick={(event) => {
          // A press from the keys is a click with no count of presses.
          setHelperAway(event.detail === 0 ? "keys" : "pointer");
          setStatus(LOOK_STATUS[onPress()]);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setHelperAway("keys");
        }}
        onBlur={() => setHelperAway(null)}
        className={cn(BUTTON_CLASSES, isFocusDrawn && FOCUS_DRAWN_CLASSES)}
      >
        {looks.map((look) => {
          const { icon: Icon, iconName } = OFFERS[look];
          return (
            <Icon
              key={look}
              aria-hidden
              data-theme-icon={iconName}
              size={ICON_SIZES.sm}
              strokeWidth={ICON_STROKE_WIDTH}
              className={shownOnClassesOf(look)}
            />
          );
        })}
        {looks.map((look) => (
          <span key={look} className={cn("sr-only", shownOnClassesOf(look))}>
            {OFFERS[look].name}
          </span>
        ))}
      </button>
      <span
        aria-hidden
        data-theme-helper
        className={cn(
          HELPER_CLASSES,
          !isPhoneDrawn && HELPER_CENTRED_CLASSES,
          isHelperDrawn ? HELPER_DRAWN_CLASSES : HELPER_SHOWN_CLASSES,
          helperAway !== null && "hidden",
        )}
      >
        {looks.map((look) => (
          <span key={look} className={shownOnClassesOf(look)}>
            {OFFERS[look].word}
          </span>
        ))}
      </span>
      <span role="status" data-theme-status className="sr-only">
        {status}
      </span>
    </span>
  );
}

/** Turns the page to the other look, and keeps the choice that makes (`nextThemeChoice`). */
function turnThePage(): ThemeLook {
  const choice = nextThemeChoice(currentThemeChoice());
  applyThemeChoice(choice);
  return shownLookOf(choice);
}

const ignore = () => undefined;

/**
 * The theme's button on the page, drawn from what `<html>` notes. It listens while it stands,
 * so a choice made in another tab is taken here at once.
 */
export function ThemeChoice() {
  useEffect(() => subscribeThemeChoice(ignore), []);
  return <ThemeButton onPress={turnThePage} />;
}
