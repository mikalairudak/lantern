"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import {
  YourDaysLedger,
  type LedgerStill,
  type RowsAtRest,
  type YourDaysLedgerProps,
} from "@/features/day/your-days-ledger";
import {
  LEDGER_NOW,
  LEDGER_SETS,
  LEDGER_STATE_DAYS,
  TWELVE_DAYS,
  WRITING_DAYS,
} from "@/features/day/your-days-ledger-examples";
import { DAYS_SHOWN_AT_FIRST, type LedgerDateKind } from "@/features/day/your-days-ledger-words";
import type { YourDay } from "@/features/day/your-days";

const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];
const THEME_VIEWS = { both: THEMES, light: ["light"], dark: ["dark"] } as const;
type ThemeView = keyof typeof THEME_VIEWS;
type Width = "phone" | "laptop";
type View = "sets" | "states";

const ignore = () => undefined;

const CONTROL_CLASSES = "rounded-sm border border-line bg-surface px-3 py-1 text-small text-ink";
const LABEL_CLASSES = "flex flex-col gap-1 text-small text-muted";
/** A cell's frame: its border outside its width, so a phone cell holds a phone's 390 px. */
const CELL_CLASSES =
  "box-content shrink-0 overflow-hidden rounded-sm border border-line bg-ground pb-6 text-ink";
/**
 * A phone's screen, a container so the type reads as on a phone, or the start screen's page on
 * a laptop. Its gutters stand inside it, as the page's do, so the block takes 358 px of a 390 px
 * phone and 1024 px of a 1152 px page.
 */
const WIDTH_CLASSES: Record<Width, string> = { phone: "@container w-phone", laptop: "w-page" };
const GUTTER_CLASSES: Record<Width, string> = { phone: "px-4", laptop: "px-16" };

/** What the switches choose for the ledger: each starts at the form the start screen draws. */
interface LedgerChoices {
  hasEnergyWire: boolean;
  /** Rows at rest on a phone; a laptop always shows three. */
  phoneRowsAtRest: RowsAtRest;
  isForgetAsked: boolean;
  dateKind: LedgerDateKind;
}

const START_SCREEN: LedgerChoices = {
  hasEnergyWire: false,
  phoneRowsAtRest: DAYS_SHOWN_AT_FIRST,
  isForgetAsked: true,
  dateKind: "day",
};

/** A state of the ledger drawn still, on the pair and another unless it needs other days. */
interface LedgerState {
  label: string;
  days: readonly YourDay[];
  still?: LedgerStill;
  isAllShownAtFirst?: boolean;
}

const STATES: readonly LedgerState[] = [
  { label: "at rest", days: LEDGER_STATE_DAYS },
  { label: "first row pointed at", days: LEDGER_STATE_DAYS, still: { pointedRow: 0 } },
  { label: "second row focused", days: LEDGER_STATE_DAYS, still: { focusedRow: 1 } },
  { label: "two being written, the light passing", days: WRITING_DAYS },
  {
    label: "two being written, under reduced motion",
    days: WRITING_DAYS,
    still: { isMotionReduced: true },
  },
  { label: "forget asked", days: LEDGER_STATE_DAYS, still: { isForgetAsking: true } },
  {
    label: "all shown: press Newest three to fold back",
    days: TWELVE_DAYS,
    isAllShownAtFirst: true,
  },
];

/**
 * The visitor's days as a ledger, in both themes, at a phone's width or the start screen's
 * column on a laptop, in every set and state. Each switch starts at the form the start screen
 * draws and sets the other answer to one of the form's questions beside it.
 */
export function YourDaysConcept() {
  const [choices, setChoices] = useState<LedgerChoices>(START_SCREEN);
  const [view, setView] = useState<View>("sets");
  const [width, setWidth] = useState<Width>("phone");
  const [themeView, setThemeView] = useState<ThemeView>("both");
  const choose = (change: Partial<LedgerChoices>) => setChoices({ ...choices, ...change });

  const ledgerProps = (days: readonly YourDay[]): YourDaysLedgerProps => ({
    days,
    now: LEDGER_NOW,
    onOpen: ignore,
    onForget: ignore,
    hasEnergyWire: choices.hasEnergyWire,
    rowsAtRest: width === "phone" ? choices.phoneRowsAtRest : DAYS_SHOWN_AT_FIRST,
    isForgetAsked: choices.isForgetAsked,
    dateKind: choices.dateKind,
  });
  // A switch draws every cell again from its first state.
  const cellKey = `${JSON.stringify(choices)}-${width}`;

  return (
    <main className="flex flex-col gap-8 px-6 py-16">
      <header className="mx-auto flex w-full max-w-page flex-col gap-2">
        <h1 className="type-voice text-display">Concept · Your days</h1>
        <p className="max-w-measure text-body text-ink-soft">
          The visitor&apos;s own days on the start screen as a ledger, a line a day with its city,
          its date and its words, and the other answers to its form&apos;s questions.
        </p>
      </header>
      <div className="mx-auto flex w-full max-w-page flex-wrap gap-4">
        <Choice
          label="Energy in a row"
          value={choices.hasEnergyWire ? "wire" : "word"}
          options={[
            ["word", "The word alone"],
            ["wire", "The scale's wire and the word"],
          ]}
          onChange={(value) => choose({ hasEnergyWire: value === "wire" })}
        />
        <Choice
          label="At rest on a phone"
          value={String(choices.phoneRowsAtRest)}
          options={[
            ["3", "Three days"],
            ["1", "One day"],
          ]}
          onChange={(value) => choose({ phoneRowsAtRest: value === "1" ? 1 : DAYS_SHOWN_AT_FIRST })}
        />
        <Choice
          label="Forget these days"
          value={choices.isForgetAsked ? "asked" : "one-press"}
          options={[
            ["asked", "Asks once"],
            ["one-press", "Forgets at one press"],
          ]}
          onChange={(value) => choose({ isForgetAsked: value === "asked" })}
        />
        <Choice
          label="The date a row says"
          value={choices.dateKind}
          options={[
            ["day", "The day's own"],
            ["asked", "When it was asked for"],
          ]}
          onChange={(value) => choose({ dateKind: value === "asked" ? "asked" : "day" })}
        />
        <Choice
          label="Show"
          value={view}
          options={[
            ["sets", "The ledger's sets"],
            ["states", "The ledger's states"],
          ]}
          onChange={(value) => setView(value === "states" ? "states" : "sets")}
        />
        <Choice
          label="Width"
          value={width}
          options={[
            ["phone", "Phone"],
            ["laptop", "Laptop"],
          ]}
          onChange={(value) => setWidth(value === "laptop" ? "laptop" : "phone")}
        />
        <Choice
          label="Theme"
          value={themeView}
          options={[
            ["both", "Both"],
            ["light", "Light"],
            ["dark", "Dark"],
          ]}
          onChange={(value) => setThemeView(value as ThemeView)}
        />
      </div>

      <div className="overflow-x-auto" data-testid="your-days-grid">
        <div className="flex w-max flex-col gap-10">
          {view === "sets"
            ? LEDGER_SETS.map(({ label, days, isAllShownAtFirst = false }) => (
                <Row key={label} label={label} width={width}>
                  {THEME_VIEWS[themeView].map((theme) => (
                    <Cell key={theme} theme={theme} width={width} caption={`${theme} theme`}>
                      <YourDaysLedger
                        key={cellKey}
                        {...ledgerProps(days)}
                        isAllShownAtFirst={isAllShownAtFirst}
                      />
                    </Cell>
                  ))}
                </Row>
              ))
            : STATES.map(({ label, days, still, isAllShownAtFirst = false }) => (
                <Row key={label} label={label} width={width}>
                  {THEME_VIEWS[themeView].map((theme) => (
                    <Cell key={theme} theme={theme} width={width} caption={`${theme} theme`}>
                      <YourDaysLedger
                        key={cellKey}
                        {...ledgerProps(days)}
                        still={still}
                        isAllShownAtFirst={isAllShownAtFirst}
                      />
                    </Cell>
                  ))}
                </Row>
              ))}
        </div>
      </div>
    </main>
  );
}

interface ChoiceProps {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}

function Choice({ label, value, options, onChange }: ChoiceProps) {
  return (
    <label className={LABEL_CLASSES}>
      {label}
      <select
        className={CONTROL_CLASSES}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

/** One set or state: its name over its cells, side by side on a phone and stacked on a laptop. */
function Row({ label, width, children }: { label: string; width: Width; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-name text-quote">{label}</h2>
      <div className={cn("flex gap-8", width === "laptop" && "flex-col")}>{children}</div>
    </section>
  );
}

interface CellProps {
  theme: Theme;
  width: Width;
  caption: string;
  children: ReactNode;
}

function Cell({ theme, width, caption, children }: CellProps) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-small text-muted">{caption}</figcaption>
      <div data-theme={theme} className={cn(CELL_CLASSES, WIDTH_CLASSES[width])}>
        <div className={GUTTER_CLASSES[width]}>{children}</div>
      </div>
    </figure>
  );
}
