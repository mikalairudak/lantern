/**
 * The spaces a server render writes as texts of their own beside another text, each as the
 * words on its two sides, "Saturday|in". React parts two texts that stand side by side with a
 * comment, and Chrome leaves a text of nothing but spaces beside such a comment out of its
 * accessibility tree, so the words on its two sides run together in a name or a line a screen
 * reader is given. A space between two elements is kept, and so is one inside a text of words.
 */
export function spacesBesideTextsOf(markup: string): string[] {
  const holder = document.createElement("div");
  holder.innerHTML = markup;
  const walker = document.createTreeWalker(holder, NodeFilter.SHOW_TEXT);
  const spaces: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const isSpace = node.textContent?.trim() === "";
    const isBesideText = [node.previousSibling, node.nextSibling].some(
      (sibling) => sibling?.nodeType === Node.COMMENT_NODE,
    );
    if (isSpace && isBesideText) spaces.push(`${wordBefore(node)}|${wordAfter(node)}`);
  }
  return spaces;
}

function wordBefore(node: Node): string {
  for (let sibling = node.previousSibling; sibling; sibling = sibling.previousSibling) {
    const text = wordsOf(sibling);
    if (text !== "") return text.split(" ").at(-1) ?? "";
  }
  return "";
}

function wordAfter(node: Node): string {
  for (let sibling = node.nextSibling; sibling; sibling = sibling.nextSibling) {
    const text = wordsOf(sibling);
    if (text !== "") return text.split(" ")[0] ?? "";
  }
  return "";
}

/** A sibling's words: a comment's text is React's mark, not the page's. */
function wordsOf(node: Node): string {
  return node.nodeType === Node.COMMENT_NODE ? "" : (node.textContent ?? "");
}
