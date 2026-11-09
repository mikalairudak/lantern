import { render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InlineScript } from "./inline-script";

describe("InlineScript", () => {
  it("is written as plain text when the browser draws it, so it never runs twice", () => {
    const { container } = render(<InlineScript html="window.ran = true" />);

    const script = container.querySelector("script");
    expect(script).toHaveAttribute("type", "text/plain");
    expect(script?.innerHTML).toBe("window.ran = true");
  });

  it("is written as JavaScript by the server, so it runs as the page is parsed", () => {
    vi.stubGlobal("window", undefined);
    try {
      expect(renderToString(<InlineScript html="window.ran = true" />)).toContain(
        'type="text/javascript"',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
