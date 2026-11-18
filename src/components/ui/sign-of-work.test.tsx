import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SIGN_MOMENTS } from "@/lib/tokens/motion";
import { SignOfWork } from "./sign-of-work";
import { SIGN_RIBS, type SignWork } from "./sign-tally";

const PARTS = ["pen", "haze", "glow", "paper", "paper-ribs"] as const;
type Part = (typeof PARTS)[number];

function draw(work: SignWork, heldAt?: keyof typeof SIGN_MOMENTS) {
  const { container } = render(<SignOfWork work={work} heldAt={heldAt} />);
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("The sign drew no SVG");
  const part = (name: Part): Element => {
    const element = svg.querySelector(`[data-part="${name}"]`);
    if (!element) throw new Error(`The sign has no ${name}`);
    return element;
  };
  return { svg, part };
}

/** How much of a stroke drawn by its dash shows: 0 none, 1 all of it. */
function drawnShareOf(stroke: Element): number {
  return 1 - Number(stroke.getAttribute("stroke-dashoffset"));
}

describe("the sign of work", () => {
  it("is hidden from a screen reader, since the words beside it say the work", () => {
    const { svg } = draw({ kind: "running" });
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("loops each of its five parts only where motion is allowed", () => {
    const { part } = draw({ kind: "running" });
    const loops: Record<Part, string> = {
      pen: "sign-cut",
      haze: "sign-haze",
      glow: "sign-glow",
      paper: "sign-light",
      "paper-ribs": "sign-ribs",
    };
    for (const name of PARTS) {
      const animations = [...part(name).classList].filter((name) => name.includes("animate-"));
      expect(animations).toEqual([`motion-safe:animate-${loops[name]}`]);
    }
  });

  it("carries no delay while it runs", () => {
    const { part } = draw({ kind: "running" });
    for (const name of PARTS) expect(part(name).getAttribute("style")).toBeNull();
  });

  it("holds the running loop at a named moment, paused that far in", () => {
    const { part } = draw({ kind: "running" }, "litWhole");
    for (const name of PARTS) {
      const style = (part(name) as SVGElement).style;
      expect(style.animationPlayState).toBe("paused");
      expect(style.animationDelay).toBe(`${-SIGN_MOMENTS.litWhole}s`);
    }
  });

  it("draws the outline alone where its loop does not run", () => {
    const { part } = draw({ kind: "running" });
    expect(drawnShareOf(part("pen"))).toBe(0);
    expect(part("paper")).toHaveAttribute("transform", "scale(0)");
    expect(part("glow")).toHaveAttribute("opacity", "0");
    expect(part("haze")).toHaveAttribute("opacity", "0");
  });

  describe("kept as a tally, with no loop", () => {
    it("runs no loop and holds nothing", () => {
      const { svg } = draw({ kind: "lit" });
      expect(svg.outerHTML).not.toContain("animate-");
      expect(svg.outerHTML).not.toContain("style=");
    });

    it("draws the outline alone at a count of none", () => {
      const { part } = draw({ kind: "cut", ribs: 0 });
      expect(drawnShareOf(part("pen"))).toBe(0);
      expect(part("paper")).toHaveAttribute("transform", "scale(0)");
    });

    it("cuts one more rib for each count, along the pen's one stroke", () => {
      const shares = Array.from({ length: SIGN_RIBS }, (_, at) =>
        drawnShareOf(draw({ kind: "cut", ribs: at + 1 }).part("pen")),
      );
      expect(shares).toEqual([0.184, 0.473, 0.757, 1].map((share) => expect.closeTo(share, 6)));
      for (let at = 1; at < shares.length; at += 1) {
        expect(shares[at]).toBeGreaterThan(shares[at - 1] ?? 1);
      }
    });

    it("never cuts more ribs than the lantern has", () => {
      const { part } = draw({ kind: "cut", ribs: SIGN_RIBS + 3 });
      expect(drawnShareOf(part("pen"))).toBe(1);
    });

    it("lights the wick over the cut ribs, the paper at a quarter of its size and unlit round it", () => {
      const { part } = draw({ kind: "wick" });
      expect(drawnShareOf(part("pen"))).toBe(1);
      expect(part("pen")).toHaveAttribute("opacity", "1");
      expect(part("paper")).toHaveAttribute("transform", "scale(0.25)");
      expect(drawnShareOf(part("paper-ribs"))).toBe(0);
      expect(part("glow")).toHaveAttribute("opacity", "0");
      expect(part("haze")).toHaveAttribute("opacity", "0");
    });

    it("lights the lantern whole: its ribs through the paper, its glow and haze round it", () => {
      const { part } = draw({ kind: "lit" });
      expect(part("paper")).toHaveAttribute("transform", "scale(1)");
      expect(drawnShareOf(part("paper-ribs"))).toBe(1);
      expect(part("pen")).toHaveAttribute("opacity", "0");
      expect(part("glow")).toHaveAttribute("opacity", "1");
      expect(part("haze")).toHaveAttribute("opacity", "1");
    });
  });

  it("cuts the lit paper's ribs by the shape of its own lantern on a page of several signs", () => {
    const { container } = render(
      <>
        <SignOfWork work={{ kind: "lit" }} />
        <SignOfWork work={{ kind: "lit" }} />
      </>,
    );
    const ids = [...container.querySelectorAll("clipPath")].map((clip) => clip.id);
    expect(new Set(ids).size).toBe(2);
    const uses = [...container.querySelectorAll("[clip-path]")].map((group) =>
      group.getAttribute("clip-path"),
    );
    expect(uses).toEqual(ids.map((id) => `url(#${id})`));
  });
});
