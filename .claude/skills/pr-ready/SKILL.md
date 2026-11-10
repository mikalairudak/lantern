---
name: pr-ready
description: Make a Lantern branch ready for its pull request, then push it and open the pull request against develop. Checks that the branch is one change and its checks ran, writes the body in the template's shape, runs the pull request text check and a security review, and gets one fresh read of what patterns cannot see.
when_to_use: Before pushing a branch and opening its pull request, or when someone says "pr-ready", "open the PR" or "ready for review". Give it the branch, as in "/pr-ready <branch>".
argument-hint: "[branch]"
arguments: [branch]
---

# Make a branch ready for its pull request

Every change reaches `develop` as a pull request the owner reviews and merges on GitHub. A branch's name, its commits and the pull request's title and body are public the moment the branch is pushed, and a push cannot be taken back (`CLAUDE.md`, "Everything committed is public"). So everything below happens before the push, in this order, and the push waits until all of it is clean. **This skill never merges.** It runs in the main session, not in a forked context, because it pushes and opens the pull request.

- **What is reviewed:** `$branch`, against `develop`. Its change is `git diff develop...$branch`, its commits `git log develop..$branch`.
- **Where:** the branch's own checkout, clean (`git status` shows nothing to commit).

## 1. One change, checked

1. Read `git log --oneline develop..$branch` and `git diff --stat develop...$branch`. The branch holds one logical change; split it when a reader would review two things.
2. The branch's name is `<kind>/<words>`: the kind a commit's subject starts with (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`), then lowercase words joined by hyphens or dots. Rename it locally if not.
3. `pnpm check` passed on the last commit: the pre-commit hook ran it. Name the other checks the definition of done in `CLAUDE.md` asks for this change, and run each: `pnpm build:check` for any change, `pnpm e2e` and `pnpm e2e:visual` for UI, with screenshots at phone and laptop width in both themes.

## 2. Write the pull request's text

1. The pull request is squash-merged: its title becomes the commit's subject on `develop`, and its body the commit's body. The title is a conventional commit's subject (`fix: …`, `feat(scope): …`); for a branch of one commit, that commit's subject.
2. Write the body in a file outside the repository, in the shape of `.github/pull_request_template.md`: `## What changes`, `## Why`, `## Look at`, `## Checked`, `## Risk`, each with at least one line. Delete every one of the template's HTML comments, since the body becomes the squash commit's body; a section that holds only its comment is empty.
3. Plain, short English. Say what is true and why. Tell no story of the work: no record of who asked or agreed, no sessions, agents, rounds or reviews, nothing personal. A commit hash is allowed here, as in a commit's message.
4. Hold the title in a single-quoted shell variable, so a `"` or `$` in it cannot break a command (write a `'` in it as `'\''`). Run the check on all three parts, and fix each fault it prints:

   ```sh
   title='fix: keep the line under the headline'
   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-pr-text.mts \
     --branch="$(git branch --show-current)" --title="$title" --body-file=<body file>
   ```

   The workflow `.github/workflows/pr-text.yml` runs the same check on GitHub, on every pull request into `develop` and again on every edit of its text.

## 3. Review its security

Run the built-in `/security-review` on the branch's diff against `develop`. Fix what it finds on the branch, in new commits, and run it again. A finding that is not fixed stays out of the pull request's text and every commit, as an open weakness stays out of the repository until it is fixed.

## 4. Get one fresh read

Patterns see only words. Start one agent that has not seen the work, on a Sonnet model, and give it only:

- the diff, `git diff develop...$branch`;
- the commit messages, `git log --format='%B' develop..$branch`;
- the pull request's title and body;
- this checklist of what a pattern cannot see:
  - anything personal about the owner or anyone else: background, plans, skills, whereabouts, words from a chat or a note;
  - text that is not English, outside the test data the hygiene test lists;
  - a record of how the work was agreed or done: conversations, approvals, requests, sessions, agents, rounds of work;
  - an open weakness described, or how one would use it, before it is fixed;
  - a provider named on a public page, in its metadata or in a response, beyond the licence-required map credit;
  - a pointer that leaks or rots: a link to a chat or a shared page, a local path, a machine or account name, a production record's id, a secret or its hash, a branch name or commit hash in a doc or comment.

It reports findings only, each with the file and line or the part of the text, and edits nothing. The author fixes each finding, runs steps 1 to 3 again for what changed, and asks for a fresh read only when a fix changed much.

## 5. Push the branch and open the pull request

Only when every step above is clean:

1. Run `git branch --show-current`. If it prints `develop` or `main`, stop: only a change's own branch is pushed.
2. Run `git config --show-origin core.hooksPath`. If the value is not what the clone's maintainer set (an install resets it to `.githooks`), stop and ask before pushing.
3. Push the branch alone: `git push -u origin $branch`. Never `develop`, `main`, a tag or another branch.
4. Open the pull request against `develop`, with the title from the same variable:

   ```sh
   gh pr create --base develop --head $branch --title "$title" --body-file <body file>
   ```

5. Give the owner the pull request's address. The owner reviews and merges it on GitHub.

## Done when

- The branch is one change, and the checks the definition of done asks for passed.
- `scripts/check-pr-text.mts` passes on the branch's name, the title and the body.
- `/security-review` and the fresh read left nothing open.
- The branch alone is pushed, and its pull request is open against `develop`.
