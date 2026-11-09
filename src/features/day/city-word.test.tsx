import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PORTLAND_MAINE, PORTLAND_OREGON } from "@/lib/fixtures/city-readings";
import { CURATED_REQUESTS, KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import type { CityReading } from "@/lib/schema/intake.schema";
import { CityWord, type CityFocus, type TypedCity } from "./city-word";

const ignore = () => undefined;

/** The city word of Kyoto's written day, opened and closed as the header does. */
function KyotoWord() {
  const [openAt, setOpenAt] = useState<CityFocus | null>(null);
  return (
    <p>
      A calm Saturday in{" "}
      <CityWord
        city={KYOTO_REQUEST.city}
        written={CURATED_REQUESTS}
        current={KYOTO_REQUEST}
        openAt={openAt}
        onOpenChange={setOpenAt}
        onChooseWritten={ignore}
        onChooseCity={ignore}
        trail=""
        isFocusedOnMount={false}
      />
    </p>
  );
}

interface TypedWordProps {
  onChooseCity: (city: string) => void;
  onOpenChange?: (openAt: CityFocus | null) => void;
  /** How the page answers a city typed: read at length, or not played for this reason. */
  answer?: TypedCity["failure"];
}

/**
 * Kyoto's city word in the day's header once live: a city typed that Lantern has not
 * written is read first, its answer given to the word as the page gives it.
 */
function TypedWord({ onChooseCity, onOpenChange, answer = null }: TypedWordProps) {
  const [openAt, setOpenAt] = useState<CityFocus | null>("elsewhere");
  const [typedCity, setTypedCity] = useState<TypedCity | null>(null);
  return (
    <>
      <CityWord
        city={KYOTO_REQUEST.city}
        written={CURATED_REQUESTS}
        current={KYOTO_REQUEST}
        openAt={openAt}
        onOpenChange={(next) => {
          setOpenAt(next);
          onOpenChange?.(next);
          // Closed, the page stops reading the typed city.
          if (next === null) setTypedCity(null);
        }}
        onChooseWritten={ignore}
        onChooseCity={(city) => {
          onChooseCity(city);
          setTypedCity({ name: city, failure: answer });
        }}
        typedCity={typedCity}
        trail=""
        isChoiceHeld
        isFocusedOnMount={false}
      />
      <button type="button">Elsewhere on the page</button>
    </>
  );
}

interface PortlandWordProps {
  onChooseReading: (reading: CityReading) => void;
  /** A choice holds the list for the day it plays, as the day's header does. */
  isChoiceHeld?: boolean;
}

/** Portland's city word, played as Oregon, over the two cities its name could mean. */
function PortlandWord({ onChooseReading, isChoiceHeld }: PortlandWordProps) {
  const [openAt, setOpenAt] = useState<CityFocus | null>(null);
  return (
    <p>
      A lively Saturday in{" "}
      <CityWord
        city={PORTLAND_OREGON.name}
        written={CURATED_REQUESTS}
        current={{
          ...KYOTO_REQUEST,
          city: PORTLAND_OREGON.name,
          timezone: PORTLAND_OREGON.timezone,
        }}
        openAt={openAt}
        onOpenChange={setOpenAt}
        onChooseWritten={ignore}
        onChooseCity={ignore}
        readings={[PORTLAND_OREGON, PORTLAND_MAINE]}
        playedReading={PORTLAND_OREGON.placeId}
        onChooseReading={onChooseReading}
        isChoiceHeld={isChoiceHeld}
        trail=""
        isFocusedOnMount={false}
      />
    </p>
  );
}

beforeAll(() => {
  // The list unfolds to its measured height; jsdom measures nothing and has no observer.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe(): void {}
      disconnect(): void {}
    },
  );
});
afterAll(() => vi.unstubAllGlobals());

describe("CityWord", () => {
  it("reopened while it rolls back into the word, gives the focus to the day's own row", async () => {
    const user = userEvent.setup();
    render(<KyotoWord />);
    const word = screen.getByRole("button", { name: "Kyoto" });
    word.focus();
    await user.keyboard("{Enter}");
    const where = screen.getByRole("group", { name: "Where" });
    const thisDay = screen.getByRole("button", { name: /^Kyoto\s*this day$/ });
    expect(thisDay).toHaveFocus();
    await user.keyboard("{ArrowDown}");

    await user.keyboard("{Escape}");
    // Still rolling back: the same list is there, and the focus is on the word.
    expect(where).toBeInTheDocument();
    expect(word).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("group", { name: "Where" })).toBe(where);
    expect(thisDay).toHaveFocus();
  });

  it("hangs its list under the word, drawn once, the day on screen checked", async () => {
    const user = userEvent.setup();
    render(<KyotoWord />);
    const word = screen.getByRole("button", { name: "Kyoto" });

    await user.click(word);

    const where = screen.getByRole("group", { name: "Where" });
    // The word is not set again as the list's top row: "Kyoto" is the word and its own row.
    const drawn = screen.getAllByText("Kyoto", { exact: true });
    expect(drawn.filter((element) => !where.contains(element))).toEqual([word]);
    expect(word).toHaveClass("aria-expanded:underline", "aria-expanded:decoration-solid");
    // Only the day on screen carries the check, and no row a bead.
    const rows = within(where).getAllByRole("button");
    expect(rows.map((row) => row.querySelector("svg.lucide-check") !== null)).toEqual([
      true,
      false,
      false,
    ]);
    expect(where.querySelectorAll("circle")).toHaveLength(0);
  });

  it("pressed again, rolls its list back into the word and keeps it closed", async () => {
    const user = userEvent.setup();
    render(<KyotoWord />);
    const word = screen.getByRole("button", { name: "Kyoto" });
    await user.click(word);
    expect(screen.getByRole("button", { name: /^Kyoto\s*this day$/ })).toHaveFocus();

    await user.click(word);

    // The focus leaving the list for the word, and the press outside it, close it as the
    // word's own press does; none of them may open it again.
    await waitFor(() => expect(screen.queryByRole("group", { name: "Where" })).toBeNull());
    expect(word).toHaveAttribute("aria-expanded", "false");
    expect(word).toHaveFocus();
  });

  it("goes at once once a reading is chosen, the focus back on the word", async () => {
    const user = userEvent.setup();
    const onChooseReading = vi.fn();
    render(<PortlandWord onChooseReading={onChooseReading} />);
    const word = screen.getByRole("button", { name: "Portland" });
    word.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: /Maine, United States/ })).toHaveFocus();

    await user.keyboard("{Enter}");

    // The day chosen takes the word's place, so the list does not roll back into the word as
    // after an Escape: the blur of the focus coming home does not turn its going into a fold.
    expect(onChooseReading).toHaveBeenCalledWith(PORTLAND_MAINE);
    expect(screen.queryByRole("group", { name: "Where" })).not.toBeInTheDocument();
    expect(word).toHaveFocus();
  });

  it("held for the day a reading plays, leaves sight at once with the focus on the row chosen", async () => {
    const user = userEvent.setup();
    const onChooseReading = vi.fn();
    render(<PortlandWord onChooseReading={onChooseReading} isChoiceHeld />);
    const word = screen.getByRole("button", { name: "Portland" });
    word.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowDown}");
    const maine = screen.getByRole("button", { name: /Maine, United States/ });

    await user.keyboard("{Enter}");

    // A choice takes the word's place at once, so the list leaves sight in the frame of the
    // choice; until the day chosen takes this one's place it stays, out of the hand's reach,
    // with the focus where it was, so the focus moves once, to the next day's word.
    expect(onChooseReading).toHaveBeenCalledWith(PORTLAND_MAINE);
    const where = screen.getByRole("group", { name: "Where" });
    expect(maine).toHaveFocus();
    expect(where).toHaveClass("pointer-events-none", "opacity-0");
    // Nothing closes it meanwhile, neither Escape nor the word, and a second choice plays
    // nothing more.
    await user.keyboard("{Escape}");
    await user.click(word);
    maine.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("group", { name: "Where" })).toBe(where);
    expect(onChooseReading).toHaveBeenCalledTimes(1);
  });

  it("keeps its list in sight while a typed city is read, its field read-only, saying so", async () => {
    const user = userEvent.setup();
    const onChooseCity = vi.fn();
    render(<TypedWord onChooseCity={onChooseCity} />);
    const field = screen.getByRole("textbox", { name: "Somewhere else" });

    await user.type(field, "Porto{Enter}");

    expect(onChooseCity).toHaveBeenCalledWith("Porto");
    const list = screen.getByRole("group", { name: "Where" });
    expect(list).toBeVisible();
    expect(list).not.toHaveClass("opacity-0");
    expect(field).toHaveValue("Porto");
    expect(field).toHaveAttribute("readonly");
    expect(within(list).getByRole("status")).toHaveTextContent("Reading");
    // Pressed again while it reads, Enter sends nothing more.
    await user.type(field, "{Enter}");
    expect(onChooseCity).toHaveBeenCalledTimes(1);
  });

  it("says why a typed city could not play, and lets it be changed and sent again", async () => {
    const user = userEvent.setup();
    const onChooseCity = vi.fn();
    render(<TypedWord onChooseCity={onChooseCity} answer="no-city" />);
    const field = screen.getByRole("textbox", { name: "Somewhere else" });
    await user.type(field, "somewhere warm{Enter}");

    const list = screen.getByRole("group", { name: "Where" });
    expect(within(list).getByRole("status")).toHaveTextContent(
      "Lantern needs a city to plan the day.",
    );
    expect(field).not.toHaveAttribute("readonly");
    await user.clear(field);
    await user.type(field, "Porto{Enter}");
    expect(onChooseCity).toHaveBeenLastCalledWith("Porto");
  });

  it("closes on Escape while a typed city is read, for the page to stop reading it", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<TypedWord onChooseCity={ignore} onOpenChange={onOpenChange} />);
    await user.type(screen.getByRole("textbox", { name: "Somewhere else" }), "Porto{Enter}");

    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenLastCalledWith(null);
  });

  it.each([
    ["Escape", (user: ReturnType<typeof userEvent.setup>) => user.keyboard("{Escape}")],
    [
      "a press outside it",
      (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole("button", { name: "Elsewhere on the page" })),
    ],
  ])("closed by %s while a typed city is read, opens again at once", async (_name, closeIt) => {
    const user = userEvent.setup();
    render(<TypedWord onChooseCity={ignore} />);
    await user.type(screen.getByRole("textbox", { name: "Somewhere else" }), "Porto{Enter}");

    await closeIt(user);
    await waitFor(() => expect(screen.queryByRole("group", { name: "Where" })).toBeNull());
    const word = screen.getByRole("button", { name: "Kyoto" });
    await user.click(word);

    expect(word).toHaveAttribute("aria-expanded", "true");
    const list = await screen.findByRole("group", { name: "Where" });
    expect(list).not.toHaveClass("opacity-0");
    expect(within(list).queryByRole("status")).toBeNull();
  });

  it("drawn open rather than opened, leaves the page's focus where it was", () => {
    const drawn = (openAt: CityFocus | null) => (
      <>
        <button type="button">Elsewhere</button>
        <CityWord
          city={KYOTO_REQUEST.city}
          written={CURATED_REQUESTS}
          current={KYOTO_REQUEST}
          openAt={openAt}
          onOpenChange={ignore}
          onChooseWritten={ignore}
          onChooseCity={ignore}
          trail=""
          isFocusedOnMount={false}
        />
      </>
    );
    const { rerender } = render(drawn(null));
    const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
    elsewhere.focus();

    rerender(drawn("nowhere"));

    expect(screen.getByRole("group", { name: "Where" })).toBeInTheDocument();
    expect(elsewhere).toHaveFocus();
  });
});
