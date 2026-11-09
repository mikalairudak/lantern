import { act, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useHydrated } from "./use-hydrated";

function Probe() {
  return <p>{useHydrated() ? "browser" : "server"}</p>;
}

describe("useHydrated", () => {
  it("says server while the page is drawn there and hydrated, then browser", async () => {
    const html = renderToString(<Probe />);
    expect(html).toContain("server");

    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.append(host);
    await act(async () => {
      hydrateRoot(host, <Probe />);
    });
    expect(host.textContent).toBe("browser");
    host.remove();
  });

  it("is hydrated from the first frame of a page drawn in the browser alone", () => {
    render(<Probe />);
    expect(screen.getByText("browser")).toBeInTheDocument();
  });
});
