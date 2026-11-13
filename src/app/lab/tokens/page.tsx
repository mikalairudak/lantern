import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import { ArrowLeftRight, MapPin, Sun } from "lucide-react";
import {
  COLOR_TOKENS,
  DURATION_TOKENS,
  FOCUS_RING_TOKENS,
  RADIUS_TOKENS,
  SPACING_TOKENS,
  TEXT_TOKENS,
  type ColorToken,
  type FocusRingToken,
  type RadiusToken,
  type SpacingToken,
  type TextToken,
} from "@/lib/tokens/catalog";
import { ICON_SIZES, ICON_STROKE_WIDTH } from "@/lib/tokens/icon";
import { MotionDemo } from "./motion-demo";
import { RootGrowth } from "./root-growth";
import { requireStudioLogin, studioMetadataOf } from "@/lib/http/studio-access";

export function generateMetadata(): Promise<Metadata> {
  return studioMetadataOf("Tokens");
}

// Class names are spelled out in full so Tailwind can find them; the Record types make
// the compiler insist on an entry for every token in the catalog.
const SWATCH_CLASSES: Record<ColorToken, string> = {
  ground: "bg-ground",
  surface: "bg-surface",
  ink: "bg-ink",
  "ink-soft": "bg-ink-soft",
  muted: "bg-muted",
  engraving: "bg-engraving",
  "engraving-night": "bg-engraving-night",
  "plate-tone": "bg-plate-tone",
  "plate-lit": "bg-plate-lit",
  "plate-lit-wide": "bg-plate-lit-wide",
  "plate-half": "bg-plate-half",
  line: "bg-line",
  wire: "bg-wire",
  amber: "bg-amber",
  lamp: "bg-lamp",
  "lamp-glow": "bg-lamp-glow",
  "lamp-haze": "bg-lamp-haze",
  energy: "bg-energy",
  curve: "bg-curve",
  swap: "bg-swap",
  "swap-drawn": "bg-swap-drawn",
};

interface TypeSpecimen {
  className: string;
  usage: string;
  sample: string;
}

// Samples are the Alicante day's own words, each in the role it takes on the abacus.
const TYPE_SPECIMENS: Record<TextToken, TypeSpecimen> = {
  display: { className: "type-voice text-display", usage: "Voice · page title", sample: "Lantern" },
  title: {
    className: "type-voice text-title",
    usage: "Voice · the request",
    sample: "A calm Saturday in Alicante, on foot",
  },
  heading: {
    className: "type-voice text-heading italic",
    usage: "Voice italic · the wordmark",
    sample: "Lantern",
  },
  sentence: {
    className: "type-voice text-sentence",
    usage: "Voice · the start screen's question on a phone",
    sample: "A day in Bologna, with friends",
  },
  dek: {
    className: "max-w-measure type-prose text-dek text-ink-soft",
    usage: "Prose · the day's line, the start screen's promise",
    sample:
      "Sunrise from the beach under the castle, the old town before it wakes, rice on the marina, and tapas standing up after nine.",
  },
  quote: {
    className: "type-name text-quote",
    usage: "Name · a place on its row",
    sample: "Castillo de Santa Bárbara",
  },
  body: {
    className: "max-w-measure text-body text-ink-soft",
    usage: "Body · a summary",
    sample: "The city's oldest church, Gothic behind a baroque front, cool and nearly empty.",
  },
  small: {
    className: "type-note text-muted",
    usage: "Note and time · beside a name",
    sample: "architecture · Benacantil",
  },
  meta: {
    className: "text-meta text-muted",
    usage: "Meta · labels in the lab",
    sample: "Lab · Tokens",
  },
  caption: {
    className: "text-caption text-muted",
    usage: "Caption · the lab's controls, and the page's foot",
    sample: "Energy",
  },
};

const SPACING_CLASSES: Record<SpacingToken, string> = {
  "0": "w-0",
  "0.5": "w-0.5",
  "1": "w-1",
  "1.5": "w-1.5",
  "2": "w-2",
  "3": "w-3",
  "4": "w-4",
  "5": "w-5",
  "6": "w-6",
  "8": "w-8",
  "9": "w-9",
  "10": "w-10",
  "11": "w-11",
  "12": "w-12",
  "14": "w-14",
  "16": "w-16",
  "20": "w-20",
  "24": "w-24",
  day: "w-day max-w-full",
  "phone-height": "w-phone-height max-w-full",
};

const RADIUS_CLASSES: Record<RadiusToken, string> = { sm: "rounded-sm" };

const FOCUS_RING_CLASSES: Record<FocusRingToken, string> = {
  "focus-ring": "focus-ring",
  "focus-ring-inset": "focus-ring-inset",
};

interface IconSample {
  icon: LucideIcon;
  label: string;
  className: string;
}

const ICON_SAMPLES: IconSample[] = [
  { icon: Sun, label: "Light", className: "text-lamp" },
  { icon: ArrowLeftRight, label: "Swap", className: "text-swap" },
  { icon: MapPin, label: "Place", className: "text-ink" },
];

const THEMES = ["light", "dark"] as const;

// It reads its request for the studio's login (`requireStudioLogin`), so it waits on it.
export const instant = false;

export default async function TokensPage() {
  await requireStudioLogin();
  return (
    <main className="mx-auto flex max-w-page flex-col gap-16 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-meta tracking-caps text-muted uppercase">Lab · Tokens</p>
        <h1 className="type-voice text-display">The closed theme</h1>
        <p className="max-w-measure type-voice text-dek text-ink-soft">
          Every color, size, space and corner the interface may use, and nothing else.
        </p>
      </header>
      <ColorSection />
      <TypeSection />
      <SpacingSection />
      <ShapeSection />
      <FocusSection />
      <Section
        title="Large screen"
        note="The root grows past a laptop's width, and every rem and the chart's drawing with it"
      >
        <RootGrowth />
      </Section>
      <Section
        title="Motion"
        note="Springs from src/lib/tokens/motion.ts, and the lengths timed in CSS from globals.css"
      >
        <MotionDemo />
        <ul className="flex flex-col gap-4">
          {DURATION_TOKENS.map(({ name, role }) => (
            <li key={name} className="flex flex-col gap-1 md:flex-row md:gap-8">
              <span className="w-label shrink-0 text-meta">--duration-{name}</span>
              <span className="text-small text-muted">{role}</span>
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}

interface SectionProps {
  title: string;
  note: string;
  children: React.ReactNode;
}

function Section({ title, note, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-6 border-t border-line pt-6">
      <div className="flex flex-col gap-1">
        <h2 className="type-voice text-title">{title}</h2>
        <p className="text-meta text-muted">{note}</p>
      </div>
      {children}
    </section>
  );
}

function ColorSection() {
  return (
    <Section title="Color" note="One token per role; each carries its light and dark value">
      <div className="grid gap-4 md:grid-cols-2">
        {THEMES.map((theme) => (
          <div
            key={theme}
            data-theme={theme}
            className="flex flex-col gap-4 rounded-sm border border-line bg-ground p-6 text-ink"
          >
            <p className="text-caption tracking-caps text-muted uppercase">{theme}</p>
            <ul className="flex flex-col gap-3">
              {COLOR_TOKENS.map(({ name, role }) => (
                <li key={name} className="flex items-center gap-4">
                  <span
                    className={`size-10 shrink-0 rounded-sm border border-line ${SWATCH_CLASSES[name]}`}
                  />
                  <span className="flex flex-col">
                    <span className="text-meta">{name}</span>
                    <span className="text-small text-muted">{role}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

function TypeSection() {
  return (
    <Section
      title="Type"
      note="One serif in one weight for every role; size and ink tell them apart"
    >
      <ul className="flex flex-col">
        {TEXT_TOKENS.map((token) => {
          const { className, usage, sample } = TYPE_SPECIMENS[token];
          return (
            <li
              key={token}
              className="flex flex-col gap-2 border-b border-line py-5 md:flex-row md:items-baseline md:gap-8"
            >
              <span className="flex w-label shrink-0 flex-col">
                <span className="text-meta">{token}</span>
                <span className="text-small text-muted">{usage}</span>
              </span>
              <span className={className}>{sample}</span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function SpacingSection() {
  return (
    <Section title="Spacing" note="A 4px grid with named steps, plus the day's heights">
      <ul className="@container flex flex-col gap-2">
        {SPACING_TOKENS.map((token) => (
          <li key={token} className="flex items-center gap-4">
            <span className="w-10 shrink-0 text-meta text-muted">{token}</span>
            <span className={`h-2 bg-energy ${SPACING_CLASSES[token]}`} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function ShapeSection() {
  return (
    <Section
      title="Shape"
      note={`Hairline rules, 2 px corners or a circle, ${ICON_STROKE_WIDTH}px icons`}
    >
      <div className="flex flex-wrap gap-10">
        {RADIUS_TOKENS.map((token) => (
          <div key={token} className="flex flex-col gap-2">
            <span className={`size-16 border border-ink bg-surface ${RADIUS_CLASSES[token]}`} />
            <span className="text-meta text-muted">rounded-{token}</span>
          </div>
        ))}
        {ICON_SAMPLES.map(({ icon: Icon, label, className }) => (
          <div key={label} className="flex flex-col gap-2">
            {/* As tall as the radius's square, and as wide as its icons need, so each is drawn
                at its own size. */}
            <span className={`flex h-16 min-w-16 items-center justify-center gap-2 ${className}`}>
              {Object.values(ICON_SIZES).map((size) => (
                <Icon
                  key={size}
                  size={size}
                  strokeWidth={ICON_STROKE_WIDTH}
                  aria-hidden
                  className="shrink-0"
                />
              ))}
            </span>
            <span className="text-meta text-muted">{label}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function FocusSection() {
  return (
    <Section title="Focus" note="The ring the keyboard's focus draws; press Tab to reach each one">
      <ul className="flex flex-wrap gap-10">
        {FOCUS_RING_TOKENS.map(({ name, role }) => (
          <li key={name} className="flex max-w-label flex-col gap-2">
            <button
              type="button"
              className={`rounded-sm border border-line bg-surface px-4 py-3 text-body ${FOCUS_RING_CLASSES[name]}`}
            >
              {name}
            </button>
            <span className="text-small text-muted">{role}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
