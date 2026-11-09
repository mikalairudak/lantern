"use client";

export interface InlineScriptProps {
  /** The script's source, run once as the browser parses the page's HTML. */
  html: string;
}

/**
 * A script that runs as the page's HTML is parsed, before the first paint, and never again.
 * The server writes it as JavaScript; a render in the browser, as React's own for a page it
 * draws there, writes it as plain text, which the browser does not run and React does not
 * warn of ("Encountered a script tag"). The type differs between the two, so the element
 * takes the server's (Next's guide, preventing-flash-before-hydration.md).
 */
export function InlineScript({ html }: InlineScriptProps) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
