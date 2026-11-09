import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CONTACT_EMAIL, FootLine, PRIVACY_PATH, ProgressLine, SOURCES } from "./foot-line";

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
});
