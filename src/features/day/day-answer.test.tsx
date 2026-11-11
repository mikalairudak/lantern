import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DayAnswer } from "@/lib/events/event.schema";
import { ANSWER_QUESTION, ANSWER_THANKS, DayAnswerLine } from "./day-answer";
import { DAY_END_EXAMPLES } from "./day-end-examples";
import { DayEnd } from "./day-end-line";

const KANAZAWA = DAY_END_EXAMPLES[0]!;

/** The line as the page holds it: the answer kept above it, told on. */
function Answering({ onAnswer }: { onAnswer: (answer: DayAnswer) => void }) {
  const [answered, setAnswered] = useState<DayAnswer | null>(null);
  return (
    <DayAnswerLine
      answered={answered}
      onAnswer={(given) => {
        setAnswered(given);
        onAnswer(given);
      }}
    />
  );
}

describe("the one-tap answer at a day's end", () => {
  it("asks once, tells the answer, and thanks in its place", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<Answering onAnswer={onAnswer} />);
    expect(screen.getByText(ANSWER_QUESTION)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Not quite" }));
    expect(onAnswer).toHaveBeenCalledWith("not-quite");
    expect(screen.getByRole("status")).toHaveTextContent(ANSWER_THANKS);
    // The question stays in the room, unseen and unheard, so nothing below moves.
    expect(screen.getByText(ANSWER_QUESTION).closest("p")).toHaveAttribute("aria-hidden", "true");
    // The focus goes with the pressed answer to the thanks, not to the page.
    await new Promise((done) => requestAnimationFrame(() => done(null)));
    expect(screen.getByRole("status")).toHaveFocus();
  });

  it("thanks rather than asks when the day opened was answered, as a re-plan draws its end again", () => {
    render(<DayAnswerLine answered="yes" onAnswer={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent(ANSWER_THANKS);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps its live region in the page before an answer, empty", () => {
    render(<DayAnswerLine answered={null} onAnswer={vi.fn()} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.getByRole("status")).not.toHaveClass("invisible");
  });

  it("is asked under a day's summary, and not under a day cut short or with no one to tell", () => {
    const { unmount } = render(<DayEnd {...KANAZAWA} calendarKey="kanazawa" onAnswer={vi.fn()} />);
    expect(screen.getByText(ANSWER_QUESTION)).toBeInTheDocument();
    unmount();

    const cut = render(<DayEnd {...KANAZAWA} isCut calendarKey="kanazawa" onAnswer={vi.fn()} />);
    expect(screen.queryByText(ANSWER_QUESTION)).toBeNull();
    cut.unmount();

    render(<DayEnd {...KANAZAWA} calendarKey="kanazawa" />);
    expect(screen.queryByText(ANSWER_QUESTION)).toBeNull();
  });
});
