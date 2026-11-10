---
name: brief-review
description: Review a Lantern brief or spec before the owner reads it - the problem and its evidence, the visitor, what is built, forks, measures, scope, risks, and every factual claim against the code - then argue it with its author until each point is agreed or stated as a fork for the owner. - When a brief or a spec is handed over for review, or someone says "brief-review" or "review this brief".
---

# Brief review

A brief is the first written stage of a piece of work: half a page to a page on the problem, who it is for, what is built, how we will know it worked, and what is left out. The owner approves briefs, and an approved brief becomes the scope. The owner does not read a whole brief. They read the author's summary and the forks the review leaves open. So the review is what stands between a weak brief and the owner's decision.

## Order of work

1. **Read the brief whole, once, before anything else.** Note your first impression in one line: would a product lead approve this as it stands?
2. **Read what it rests on.** Read the files the brief cites, and the code behind each factual claim. The reviewer agent's "Read before reviewing" list is where to start.
3. **Check each item on the list below.** For each finding, write down where it is in the brief, what is wrong, why it matters, and what you would write instead.
4. **Write the review** to `<brief>.review.md` beside the brief, in the shape below.
5. **Send the author the verdict and the top findings,** in a short message. Then argue: answer each reply on its merits. Concede when you are shown wrong. When neither of you moves after one exchange on a point, record it under "Forks for the owner". Do not reopen it.
6. **Close.** When every finding is settled or recorded as a fork, update the review file: mark each finding agreed, changed or fork, and write the final verdict. Tell the author it is closed.

## Checklist

- **Problem.** Is it real, specific, and backed by evidence, data or a cited decision? Or is it a solution posing as a problem?
- **Visitor and job.** Is it said who this is for and what they came to do? Are the people given equal weight actually equal?
- **What is built.** Does every item follow from the problem? Is anything built because it is interesting rather than needed?
- **Forks.** Is every real choice stated, with its options, their costs, and a recommendation? Is any choice hidden inside a "we will"?
- **Measures.** Can each success measure be collected, with Lantern's events or a planned one, without breaking its privacy rules? Is the sample size honest? Is there a baseline?
- **Scope.** Are the boundaries explicit? Is it clear what belongs to another brief or milestone? Could this be sliced into small PRs?
- **Constraints.** Does it respect the rules in `CLAUDE.md`: schema-driven components, every lifecycle state, tokens only, no provider names on public pages, privacy?
- **Risks.** Are the real risks named: scope, cost, quality, the signature being lost? Are any invented?
- **Facts.** Is every number, file path, event name, limit and decision cited true in the code and docs today? Quote what you checked.
- **Product sense.** Would this make a visitor's first 30 seconds better? Would it make a reader of the code think better of the work? Say plainly if not.
- **Language.** Is the brief clear, short and in plain English, so the author's summary of it will be too?

## Review file

```
# Review — <brief title>

Verdict: approve | approve with changes | rework
One paragraph: the overall read.

## Findings
1. [must | should | could] <short title> — where; what is wrong; why it matters; suggested text.
   Status: open | agreed | changed | fork

## Facts checked
- <claim> — <file:line or data> — true | false

## Forks for the owner
- <the question> — Author: <position, one line>. Reviewer: <position, one line>.
```

`must` means the brief should not reach the owner without the change. `should` means a clear improvement. `could` means a suggestion.

## Rules

- Review the brief, not the author.
- Do not rewrite the brief. Suggest text; the author edits.
- Briefs live in the gitignored `/notes/`, and so do reviews. Nothing you write is committed.
- Do not run paid or live calls, `pnpm prod:read`, test suites or the dev server.
