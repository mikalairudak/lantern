import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LISBON_REQUEST } from "@/lib/fixtures/curated/requests";
import { spacesBesideTextsOf } from "@/lib/fixtures/server-markup";
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

  it.each([
    ["at the start of a sentence", false],
    ["mid-sentence", true],
  ])(
    "writes no space on the server as a text of its own beside another text, %s",
    (_, isMidSentence) => {
      const markup = renderToString(
        <AskedSentence request={LISBON_REQUEST} isMidSentence={isMidSentence} />,
      );

      expect(spacesBesideTextsOf(markup)).toEqual([]);
    },
  );

  it("sets the energy word in its colour", () => {
    render(<AskedSentence request={LISBON_REQUEST} />);

    expect(screen.getByText("lively")).toHaveClass("text-energy");
  });
});
