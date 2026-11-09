import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LISBON_REQUEST } from "@/lib/fixtures/curated/requests";
import { QUICK_STARTS } from "@/lib/days/written/quick-starts";
import { requestSentenceOf } from "./sentence";
import { AskedSentence } from "./asked-sentence";

describe("AskedSentence", () => {
  it("says a written day as its headline does", () => {
    const { container } = render(<AskedSentence request={LISBON_REQUEST} />);

    expect(container.textContent).toBe(requestSentenceOf(LISBON_REQUEST));
  });

  it.each(QUICK_STARTS.map(({ request }) => [request.city, request] as const))(
    "says the start's day in %s as its headline does",
    (_, request) => {
      const { container } = render(<AskedSentence request={request} />);

      expect(container.textContent).toBe(requestSentenceOf(request));
    },
  );

  it("sets the energy word in its colour", () => {
    render(<AskedSentence request={LISBON_REQUEST} />);

    expect(screen.getByText("lively")).toHaveClass("text-energy");
  });
});
