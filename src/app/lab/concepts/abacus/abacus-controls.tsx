"use client";

import { cn } from "@/components/ui/cn";
import { THEME_CHOICES, type ThemeChoice } from "@/features/theme/theme";

export const STREAM_CHOICES = ["replay", "realistic"] as const;
/**
 * The phrased replay, or a simulated live model with its pauses and bursts, where the
 * day's voice waits in each silence.
 */
export type StreamChoice = (typeof STREAM_CHOICES)[number];

export const NEXT_CHANGE_CHOICES = ["ok", "fail"] as const;
/** Whether the next re-composition succeeds or fails after its first pause, once. */
export type NextChangeChoice = (typeof NEXT_CHANGE_CHOICES)[number];

interface AbacusControlsProps {
  stream: StreamChoice;
  onStreamChange: (stream: StreamChoice) => void;
  nextChange: NextChangeChoice;
  onNextChangeChange: (nextChange: NextChangeChoice) => void;
  theme: ThemeChoice;
  onThemeChange: (theme: ThemeChoice) => void;
  /** Reset waits until the day is written: before that there is nothing to reset. */
  isResetEnabled: boolean;
  onReset: () => void;
  onReplay: () => void;
}

const CONTROL_CLASSES = "rounded-sm px-2 py-1 type-note transition-colors";
const ROW_CLASSES = "flex flex-wrap items-center justify-end gap-2";

/**
 * Lab chrome, kept apart from the product: how the day arrives, whether the next change
 * fails, the theme, a reset to the model's picks, and a replay. On a phone it sits at the
 * end of the page, so it never covers the chart; from `md` it floats in the corner.
 */
export function AbacusControls({
  stream,
  onStreamChange,
  nextChange,
  onNextChangeChange,
  theme,
  onThemeChange,
  isResetEnabled,
  onReset,
  onReplay,
}: AbacusControlsProps) {
  return (
    <aside
      aria-label="Lab controls"
      className="mr-4 mb-4 ml-auto flex w-fit flex-col items-end gap-1 rounded-md border border-line bg-surface p-1 md:fixed md:right-4 md:bottom-4 md:z-20 md:m-0"
    >
      <div className={ROW_CLASSES}>
        <Choice label="Stream" choices={STREAM_CHOICES} value={stream} onChange={onStreamChange} />
      </div>
      <div className={ROW_CLASSES}>
        <Choice
          label="Next change"
          choices={NEXT_CHANGE_CHOICES}
          value={nextChange}
          onChange={onNextChangeChange}
        />
      </div>
      <div className={ROW_CLASSES}>
        <Choice
          label="Theme"
          choices={THEME_CHOICES}
          value={theme}
          onChange={onThemeChange}
          isLabelShown={false}
        />
        <Separator />
        <button
          type="button"
          disabled={!isResetEnabled}
          onClick={onReset}
          className={cn(
            CONTROL_CLASSES,
            isResetEnabled ? "text-energy hover:text-ink" : "text-muted",
          )}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onReplay}
          className={cn(CONTROL_CLASSES, "text-energy hover:text-ink")}
        >
          Replay
        </button>
      </div>
    </aside>
  );
}

function Separator() {
  return <span aria-hidden className="h-4 border-l border-line" />;
}

interface ChoiceProps<T extends string> {
  label: string;
  choices: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Visible before the choices; the theme needs none. */
  isLabelShown?: boolean;
}

function Choice<T extends string>({
  label,
  choices,
  value,
  onChange,
  isLabelShown = true,
}: ChoiceProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex items-center">
      {isLabelShown && (
        <span aria-hidden className="pr-1 pl-2 type-note text-muted">
          {label}
        </span>
      )}
      {choices.map((choice) => (
        <button
          key={choice}
          type="button"
          aria-pressed={choice === value}
          onClick={() => onChange(choice)}
          className={cn(
            CONTROL_CLASSES,
            choice === value ? "bg-ground text-ink" : "text-muted hover:text-ink",
          )}
        >
          {choice}
        </button>
      ))}
    </div>
  );
}
