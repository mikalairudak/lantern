"use client";

import { AnimatePresence } from "motion/react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useCallback, useId, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/components/ui/cn";
import type { FoldExit } from "@/components/ui/fold";
import { WordPicker, type OptionView } from "@/features/day/sentence-word";
import { ICON_SIZES, ICON_STROKE_WIDTH } from "@/lib/tokens/icon";
import {
  THEME_CHOICES,
  applyThemeChoice,
  readThemeChoice,
  serverThemeChoice,
  subscribeThemeChoice,
  type ThemeChoice as Choice,
} from "./theme";

/** What the setting is called, before the choice, in the button's name and in its hint. */
export const THEME_WORD = "Theme";

const LABELS: Readonly<Record<Choice, string>> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

/** What a choice changes, where its name alone does not say it. */
const CONSEQUENCES: Readonly<Record<Choice, string | null>> = {
  system: "as this device is set",
  light: null,
  dark: null,
};

const ICONS: Readonly<Record<Choice, LucideIcon>> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

/**
 * Each choice's icon and name, shown only while `<html>` notes that choice (`globals.css`).
 * The server cannot know the choice, so its page carries all three, and the head script's
 * note picks one before the first paint: the server's page and the first frame agree.
 */
const CHOSEN_CLASSES: Readonly<Record<Choice, string>> = {
  system: "hidden chose-system:inline",
  light: "hidden chose-light:inline",
  dark: "hidden chose-dark:inline",
};

/**
 * The icon as a button of its own kind, not a word: no underline, soft ink that turns ink
 * under the pointer and while its list is open. Its box is a 32 px target, pulled out by
 * its margins so the icon's edge is the masthead's and the line keeps its height.
 */
const BUTTON_CLASSES =
  "peer -my-2 -mr-2 flex size-8 items-center justify-center rounded-sm text-ink-soft transition-colors pointed:text-ink aria-expanded:text-ink focus-ring-inset";

/**
 * The hint under the icon, "Theme · System": the masthead's small type, no bubble, laid
 * over the page so it moves nothing, and gone while the list hangs where it would be.
 */
const HINT_CLASSES =
  "pointer-events-none absolute top-full right-0 mt-1 whitespace-nowrap type-note text-muted peer-aria-expanded:invisible";
/** Shown under the pointer and on the keyboard's focus, as a reader reaches the icon. */
const HINT_HIDDEN_CLASSES = "invisible peer-hover:visible peer-focus-visible:visible";

function optionsOf(choice: Choice): OptionView[] {
  return THEME_CHOICES.map((value) => ({
    value,
    label: LABELS[value],
    consequence: CONSEQUENCES[value],
    isCurrent: value === choice,
    icon: ICONS[value],
  }));
}

function isChoice(value: string): value is Choice {
  return (THEME_CHOICES as readonly string[]).includes(value);
}

export interface ThemeWordProps {
  /** The theme the page is set in. */
  choice: Choice;
  onChoose: (choice: Choice) => void;
  /** Drawn open, as a lab cell shows it, without taking the page's focus. */
  isDrawnOpen?: boolean;
  /**
   * The icon and the hint drawn from `choice` rather than from what `<html>` notes, as a lab
   * cell draws each of the three choices on one page. The page itself draws from `<html>`.
   */
  isChoiceDrawn?: boolean;
  /** The hint drawn as the pointer or the keyboard's focus shows it, as a lab cell does. */
  isHintDrawn?: boolean;
}

/**
 * The theme in the masthead: an icon for the choice, Monitor for the system's, Sun or Moon
 * for light or dark, which opens the headline words' list, the choice marked with a check. A
 * hint names the setting and the choice under the pointer or the keyboard's focus, hung from
 * the icon's own box. The list stands beside that box, not in it, so it hangs from the nearest
 * positioned box around the icon: on a page the masthead's row, as the day menu does.
 */
export function ThemeWord({
  choice,
  onChoose,
  isDrawnOpen = false,
  isChoiceDrawn = false,
  isHintDrawn = false,
}: ThemeWordProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exit, setExit] = useState<FoldExit>({ isInstant: false });
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const isShown = isOpen || isDrawnOpen;
  const drawnChoices = isChoiceDrawn ? [choice] : THEME_CHOICES;
  const shownClassesOf = (each: Choice) => (isChoiceDrawn ? undefined : CHOSEN_CLASSES[each]);

  const close = useCallback((isFocusReturned: boolean, isInstant = false) => {
    setExit({ isInstant });
    setIsOpen(false);
    if (isFocusReturned) button.current?.focus();
  }, []);

  return (
    <>
      <span className="relative inline-flex">
        <button
          ref={button}
          type="button"
          aria-label={`${THEME_WORD}: ${LABELS[choice]}`}
          aria-haspopup="listbox"
          aria-expanded={isShown}
          aria-controls={isShown ? listId : undefined}
          onClick={() => {
            if (isOpen) close(true);
            else setIsOpen(true);
          }}
          className={BUTTON_CLASSES}
        >
          {drawnChoices.map((each) => {
            const Icon = ICONS[each];
            return (
              <Icon
                key={each}
                aria-hidden
                data-theme-icon={each}
                size={ICON_SIZES.sm}
                strokeWidth={ICON_STROKE_WIDTH}
                className={shownClassesOf(each)}
              />
            );
          })}
        </button>
        <span
          aria-hidden
          data-theme-hint
          className={cn(HINT_CLASSES, !isHintDrawn && HINT_HIDDEN_CLASSES)}
        >
          {THEME_WORD} ·{" "}
          {drawnChoices.map((each) => (
            <span key={each} className={shownClassesOf(each)}>
              {LABELS[each]}
            </span>
          ))}
        </span>
      </span>
      <AnimatePresence custom={exit}>
        {isShown && (
          <WordPicker
            key="picker"
            id={listId}
            word={button}
            options={optionsOf(choice)}
            listLabel={THEME_WORD}
            isFocusTaken={!isDrawnOpen}
            hang="masthead"
            onChoose={(value) => {
              close(true, true);
              if (isChoice(value)) onChoose(value);
            }}
            onClose={close}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * The theme's icon, set to the page's theme, which a choice changes and keeps: the list closes
 * at once, before the page crosses to the new theme (`applyThemeChoice`).
 */
export function ThemeChoice() {
  const choice = useSyncExternalStore(subscribeThemeChoice, readThemeChoice, serverThemeChoice);
  return <ThemeWord choice={choice} onChoose={applyThemeChoice} />;
}
