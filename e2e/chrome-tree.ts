import type { Page } from "./fixtures";

/** What Chrome's accessibility tree holds for one element. */
export interface ChromeRead {
  /** Its name, as a screen reader is given it. */
  name: string;
  /** The words of the texts under it, in order, as a screen reader reads the line. */
  text: string;
  /** A heading's level; null for any other role. */
  level: number | null;
}

/**
 * Every element of a role that Chrome's accessibility tree does not ignore, with its name and
 * text there. Playwright works a name and a text out on its own, from the page, and keeps
 * spaces Chrome's tree leaves out, so a space a screen reader may not hear is read here.
 */
export async function chromeReadOf(page: Page, role: string): Promise<ChromeRead[]> {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  await cdp.detach();
  const byId = new Map(nodes.map((node) => [node.nodeId, node]));
  const textOf = (nodeId: string): string => {
    const node = byId.get(nodeId);
    if (!node) return "";
    if (node.role?.value !== "StaticText") return (node.childIds ?? []).map(textOf).join("");
    return node.ignored ? "" : String(node.name?.value ?? "");
  };
  return nodes
    .filter((node) => !node.ignored && node.role?.value === role)
    .map((node) => {
      const level = node.properties?.find(({ name }) => name === "level")?.value.value;
      return {
        name: String(node.name?.value ?? ""),
        text: textOf(node.nodeId),
        level: typeof level === "number" ? level : null,
      };
    });
}
