"use client";

import { MotionConfig } from "motion/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { PartSlip, type SlipPlacement } from "@/features/day/part-slip";
import { planForkOf } from "@/features/day/plan-fork";
import { ReadingList } from "@/features/day/reading-list";
import type { ReplanControls, ReplanStatus } from "@/features/day/replan-controls";
import { forkViewOf, type ForkView } from "@/features/day/replan-work";
import { SPRINGS } from "@/lib/tokens/motion";
import {
  ELCHE_BENCH,
  UTRECHT_BENCH,
  kyotoBenchOf,
  type BenchDay,
  type ForkBench,
  type WritingStep,
} from "./fork-benches";

const STATES = ["writing", "whole", "taken", "taken back", "a failure"] as const;
type StateName = (typeof STATES)[number];

const WIDTHS = ["phone", "laptop"] as const;
type Width = (typeof WIDTHS)[number];

const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

const VIEWS = ["at a width", "margin or column"] as const;
type View = (typeof VIEWS)[number];

const PLACEMENTS = ["margin", "column"] as const;

const ignore = () => undefined;

/** Where a fork stands at one of the bench's states, as the page's change says it. */
interface ForkAt {
  status: Exclude<ReplanStatus, "idle">;
  step: WritingStep | null;
}

function forkAtOf(state: StateName, step: WritingStep | null): ForkAt {
  switch (state) {
    case "writing":
      return { status: "writing", step };
    case "whole":
      return { status: "proposed", step: null };
    case "taken":
      return { status: "taken", step: null };
    case "taken back":
      return { status: "left", step: null };
    case "a failure":
      return { status: "failed", step: null };
  }
}

/**
 * The slip's view, as the page works it out from its change: the version not on screen stands
 * beside the day while the fork does, so its receipt is said once a version is chosen too.
 */
function viewOf(bench: ForkBench, { status, step }: ForkAt): ForkView {
  const receipt =
    status === "taken"
      ? bench.receipts.before
      : status === "proposed" || status === "left"
        ? bench.receipts.proposal
        : null;
  const controls: ReplanControls = {
    status,
    change: bench.change,
    reach: bench.reach,
    ending: status === "failed" ? "invalid" : null,
    written: step?.written ?? null,
    windows: bench.windows,
    isCompared: true,
    choose: () => false,
    compare: ignore,
    askAgain: ignore,
  };
  const view = forkViewOf({
    replan: controls,
    frame: step?.frame ?? null,
    isLookingDue: step?.isLookingDue ?? true,
    receipt,
  });
  if (view === null) throw new Error("A fork on the bench has no view");
  return view;
}

/** The plan: the day alone, each part's slip at the head of its part. */
function SlipPlan({
  bench,
  at,
  placement,
}: {
  bench: ForkBench;
  at: ForkAt;
  placement: SlipPlacement;
}) {
  const view = viewOf(bench, at);
  const day = at.status === "taken" ? bench.after : bench.before;
  const other =
    at.status === "taken"
      ? bench.before
      : at.status === "writing"
        ? (at.step?.finished ?? [])
        : at.status === "failed"
          ? []
          : bench.after;
  const fork = planForkOf(day, other, bench.windows);
  return (
    <ReadingList
      stops={day}
      entered={day.length}
      versionsShown={new Set(day.map(({ id }) => id))}
      picks={day.map(() => 0)}
      daylight={bench.daylight}
      parts={{
        anchors: fork.anchors,
        isBeside: placement === "margin",
        // An ending without a proposal is said once, at the fork's first part.
        headOf: (part) =>
          view.isFailed && part > 0 ? null : (
            <PartSlip
              view={view}
              shown={fork.shown[part] ?? []}
              other={fork.other[part] ?? []}
              opens={bench.windows[part]?.opens ?? null}
              index={part}
              count={bench.windows.length}
              reach={bench.reach}
              placement={placement}
              onChoose={ignore}
              onAskAgain={ignore}
            />
          ),
      }}
    />
  );
}

interface FrameProps {
  label: string;
  width: Width;
  theme: Theme;
  children: ReactNode;
}

/**
 * One plan as a screen of that width shows it: a phone's 390 px, its gutters inside, or a
 * laptop's whole column, the plan and the margin beside it, 1024 px at 1280.
 */
function Frame({ label, width, theme, children }: FrameProps) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="px-4 text-small text-muted md:px-0">{label}</figcaption>
      <div
        data-theme={theme}
        data-frame={label}
        className={cn(
          "flex shrink-0 bg-ground py-6 text-ink",
          width === "phone" && "@container w-phone",
        )}
      >
        <MotionConfig reducedMotion="user" transition={SPRINGS.layout}>
          <div className={width === "phone" ? "min-w-0 grow px-4" : "w-abacus shrink-0"}>
            {children}
          </div>
          {width === "laptop" && <div aria-hidden className="w-margin shrink-0" />}
        </MotionConfig>
      </div>
    </figure>
  );
}

/**
 * A changed word's fork on the plan, the day alone and each part's other version as a slip
 * (`docs/decisions.md`, "The plan lists the day alone, and a part's other version stands beside
 * it as a slip"): the recorded Elche proposal, Utrecht's morning made early and a whole Kyoto day
 * written again for friends, each while written, step by step, whole, taken, taken back and
 * ended without a proposal, at a phone's width and a laptop's, in either theme; and on a laptop,
 * the slip in the margin beside it in the column.
 */
export function ForkConcept({ kyotoFriends }: { kyotoFriends: BenchDay }) {
  const benches = useMemo(
    (): Record<string, ForkBench> => ({
      Elche: ELCHE_BENCH,
      "Utrecht, early": UTRECHT_BENCH,
      "Kyoto, a whole day": kyotoBenchOf(kyotoFriends),
    }),
    [kyotoFriends],
  );
  const benchNames = Object.keys(benches);
  const [benchName, setBenchName] = useState(benchNames[0] ?? "Elche");
  const [state, setState] = useState<StateName>("whole");
  const [stepIndex, setStepIndex] = useState(0);
  const [width, setWidth] = useState<Width>("phone");
  const [theme, setTheme] = useState<Theme>("dark");
  const [view, setView] = useState<View>("at a width");
  const [placement, setPlacement] = useState<SlipPlacement>("margin");
  const bench = benches[benchName] ?? ELCHE_BENCH;
  const steps = useSteps(benchName, bench);
  const step = steps?.[Math.min(stepIndex, steps.length - 1)] ?? null;
  const at = forkAtOf(state, step);
  const isReading = state === "writing" && step === null;
  const key = `${benchName}:${state}`;

  return (
    <div className="min-h-dvh bg-surface py-10 text-ink md:px-10">
      <header className="flex max-w-page flex-col gap-4 px-4 md:px-0">
        <h1 className="type-voice text-title">The fork on the plan: the slip</h1>
        <div aria-label="Bench controls" className="flex flex-col gap-2">
          <ChoiceGroup label="Day" names={benchNames} chosen={benchName} onChoose={setBenchName} />
          <ChoiceGroup label="State" names={STATES} chosen={state} onChoose={setState} />
          {state === "writing" && (
            <div role="group" aria-label="Step" className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
                className={cn(CONTROL_CLASSES, "text-ink")}
              >
                Earlier
              </button>
              <button
                type="button"
                onClick={() =>
                  setStepIndex((index) => Math.min((steps?.length ?? 1) - 1, index + 1))
                }
                className={cn(CONTROL_CLASSES, "text-ink")}
              >
                Later
              </button>
              <span data-step={stepIndex} className="text-small text-muted">
                {step === null
                  ? "Reading the stream…"
                  : `Step ${Math.min(stepIndex, (steps?.length ?? 1) - 1) + 1} of ${steps?.length}: ${step.label}`}
              </span>
            </div>
          )}
          <ChoiceGroup label="View" names={VIEWS} chosen={view} onChoose={setView} />
          {view === "at a width" && (
            <ChoiceGroup label="Width" names={WIDTHS} chosen={width} onChoose={setWidth} />
          )}
          {view === "at a width" && width === "laptop" && (
            <ChoiceGroup
              label="Slip"
              names={PLACEMENTS}
              chosen={placement}
              onChoose={setPlacement}
            />
          )}
          <ChoiceGroup label="Theme" names={THEMES} chosen={theme} onChoose={setTheme} />
        </div>
      </header>
      {!isReading && (
        <div className="mt-10 flex flex-wrap items-start gap-10">
          {view === "at a width" ? (
            <Frame label="the plan" width={width} theme={theme}>
              <SlipPlan
                key={key}
                bench={bench}
                at={at}
                placement={width === "phone" ? "column" : placement}
              />
            </Frame>
          ) : (
            PLACEMENTS.map((each) => (
              <Frame key={each} label={`the slip in the ${each}`} width="laptop" theme={theme}>
                <SlipPlan key={key} bench={bench} at={at} placement={each} />
              </Frame>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** The frames of a bench's proposal, read once a bench is chosen; null until then. */
function useSteps(name: string, bench: ForkBench): WritingStep[] | null {
  const [read, setRead] = useState<{ name: string; steps: WritingStep[] } | null>(null);
  useEffect(() => {
    let isCurrent = true;
    void bench.steps().then((steps) => {
      if (isCurrent) setRead({ name, steps });
    });
    return () => {
      isCurrent = false;
    };
  }, [name, bench]);
  return read?.name === name ? read.steps : null;
}

interface ChoiceGroupProps<Name extends string> {
  label: string;
  names: readonly Name[];
  chosen: Name;
  onChoose: (name: Name) => void;
}

/** One of the bench's choices: its options as buttons, the chosen one pressed. */
function ChoiceGroup<Name extends string>({
  label,
  names,
  chosen,
  onChoose,
}: ChoiceGroupProps<Name>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1">
      <span className="w-16 text-small text-muted">{label}</span>
      {names.map((name) => (
        <button
          key={name}
          type="button"
          aria-pressed={name === chosen}
          onClick={() => onChoose(name)}
          className={cn(
            CONTROL_CLASSES,
            name === chosen ? "bg-ground text-ink" : "text-muted hover:text-ink",
          )}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

const CONTROL_CLASSES = "rounded-sm px-2 py-1 type-note focus-ring";
