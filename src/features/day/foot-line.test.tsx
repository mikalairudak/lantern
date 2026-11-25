import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  CONTACT_EMAIL,
  FootLine,
  PRIVACY_PATH,
  ProgressLine,
  SHOW_WHOLE_DAY,
  SOURCES,
} from "./foot-line";

describe("FootLine", () => {
  it("says what Lantern keeps and where to write, as the page's contentinfo", () => {
    render(<FootLine />);

    const footer = screen.getByRole("contentinfo");
    const links = within(footer).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Privacy and terms", CONTACT_EMAIL]);
    expect(links[0]).toHaveAttribute("href", PRIVACY_PATH);
    expect(links[1]).toHaveAttribute("href", "mailto:support@lanternday.com");
    for (const link of links) expect(link).toHaveClass("underline");
  });

  it("credits no source unless the page shows places", () => {
    render(<FootLine />);

    expect(screen.queryByRole("link", { name: /OpenStreetMap/ })).toBeNull();
    expect(screen.getByRole("contentinfo").querySelectorAll("p")).toHaveLength(1);
  });

  it("credits a day's sources after Lantern's links, OpenStreetMap then Geoapify, each linked to its own terms", () => {
    render(<FootLine sources={SOURCES} />);

    const links = within(screen.getByRole("contentinfo")).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Privacy and terms",
      CONTACT_EMAIL,
      "© OpenStreetMap contributors",
      "Powered by Geoapify",
    ]);
    expect(links[2]).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
    expect(links[3]).toHaveAttribute("href", "https://www.geoapify.com/");
    for (const link of links) expect(link).toHaveClass("underline");
  });

  it("stands apart from the page by a rule, in the smallest type and muted, Lantern's links on the right once it is a text column wide", () => {
    render(<FootLine sources={SOURCES} />);

    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveClass(
      "@container",
      "border-t",
      "border-line",
      "text-caption",
      "text-muted",
    );
    expect(footer.firstElementChild).toHaveClass(
      "flex-col",
      "@measure:flex-row-reverse",
      "@measure:justify-between",
    );
  });

  it("joins each side's links with a middle dot, unheard", () => {
    const { container } = render(
      <FootLine
        sources={[
          { name: "One", href: "https://one.example/" },
          { name: "Two", href: "https://two.example/" },
          { name: "Three", href: "https://three.example/" },
        ]}
      />,
    );

    const [lantern, credits] = container.querySelectorAll("p");
    expect(lantern?.textContent).toBe(`Privacy and terms·${CONTACT_EMAIL}`);
    expect(credits?.textContent).toBe("One·Two·Three");
    expect(container.querySelectorAll("[aria-hidden]")).toHaveLength(3);
  });
});

describe("ProgressLine", () => {
  it("says how far the day is written on a line of its own, in the stronger quiet ink", () => {
    render(<ProgressLine>Writing the day · 6 stops so far</ProgressLine>);

    const line = screen.getByText("Writing the day · 6 stops so far");
    expect(line.tagName).toBe("P");
    expect(line).toHaveClass("text-caption", "text-ink-soft");
    // One ink only: the class helper joins, so a second would win by the stylesheet's order.
    expect(line).not.toHaveClass("text-muted");
  });

  it("offers no press beside its words where the day cannot be shown whole", () => {
    render(<ProgressLine>Writing the day · 6 stops so far</ProgressLine>);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers a written day's play whole after its words, as a native button named by its words", async () => {
    const onShowWhole = vi.fn();
    const { container } = render(
      <ProgressLine onShowWhole={onShowWhole}>Writing the day · 6 stops so far</ProgressLine>,
    );

    const press = screen.getByRole("button", { name: SHOW_WHOLE_DAY });
    expect(press).toHaveAttribute("type", "button");
    expect(press).toHaveClass("underline", "focus-ring");
    // The words first, as they are read, then the press, in the line's own quiet ink.
    expect(container.textContent).toBe(`Writing the day · 6 stops so far${SHOW_WHOLE_DAY}`);
    expect(container.firstElementChild).toHaveClass("text-caption", "text-ink-soft");
    await userEvent.click(press);
    expect(onShowWhole).toHaveBeenCalledTimes(1);
  });

  it("is reached by Tab and pressed with Enter", async () => {
    const onShowWhole = vi.fn();
    render(
      <ProgressLine onShowWhole={onShowWhole}>
        Writing quieter and livelier versions · 4 of 9 stops
      </ProgressLine>,
    );

    await userEvent.tab();
    expect(screen.getByRole("button", { name: SHOW_WHOLE_DAY })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onShowWhole).toHaveBeenCalledTimes(1);
  });

  it("offers the press alone before the day has a stop to count, in the place it keeps after", () => {
    const { container } = render(<ProgressLine onShowWhole={() => undefined}>{null}</ProgressLine>);

    const press = screen.getByRole("button", { name: SHOW_WHOLE_DAY });
    // The words' line held on a phone, unseen and unheard, so the press never steps down.
    const [held, pressLine] = container.querySelectorAll("p");
    expect(held).toHaveAttribute("aria-hidden", "true");
    expect(held).toHaveClass("invisible", "@measure:hidden");
    expect(pressLine).toContainElement(press);
  });

  it("stands the press under the words on a phone, and at the line's end once a text column wide", () => {
    const { container } = render(
      <ProgressLine onShowWhole={() => undefined}>Writing the day · 1 stop so far</ProgressLine>,
    );

    const line = container.firstElementChild;
    expect(line).toHaveClass("@container");
    expect(line?.firstElementChild).toHaveClass("flex-col", "@measure:flex-row");
    expect(screen.getByRole("button", { name: SHOW_WHOLE_DAY }).parentElement).toHaveClass(
      "@measure:ml-auto",
    );
  });
});
