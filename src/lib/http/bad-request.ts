import type { z } from "zod";
import { formatPath } from "@/lib/quality/path";

/**
 * The 400 the POST routes that take JSON answer a body they cannot read: the day's, the
 * intake's and the re-plan's, each issue at a path a person reads. Loadable in a browser, as
 * the day route's body is (`src/lib/stream/answer-day-request.ts`).
 */

const HTTP_BAD_REQUEST = 400;

/** One thing wrong with a request, at a path a person reads: `energy`, `date`. */
export interface RequestIssue {
  path: string;
  message: string;
}

/** Each issue zod found in a body, at its path, or at `request` for the body as a whole. */
export function issuesOf(error: z.ZodError): RequestIssue[] {
  return error.issues.map((issue) => ({
    path: formatPath(issue.path) || "request",
    message: issue.message,
  }));
}

/** A 400 that lists what is wrong with the request. */
export function badRequest(issues: RequestIssue[]): Response {
  return Response.json({ issues }, { status: HTTP_BAD_REQUEST });
}
