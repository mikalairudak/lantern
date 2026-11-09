import { BROWSER_TEXT_ATTRIBUTE } from "@/lib/tokens/root";

/**
 * An unseen element at the browser's own text size, `medium`, which the visitor sets and the
 * root grows from on a large screen. Hidden, it still has a computed size, so the page reads
 * how far the root has grown (`rootGrowth`) and draws the chart by that alone, never by the
 * visitor's text size. Rendered once, by the root layout.
 */
export function BrowserTextSize() {
  return <span hidden {...{ [BROWSER_TEXT_ATTRIBUTE]: "" }} className="browser-text-size" />;
}
