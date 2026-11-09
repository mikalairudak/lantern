# Security policy

## Reporting a vulnerability

Report it privately: through GitHub's private vulnerability reporting on this repository (the Security tab, "Report a vulnerability"), or by mail to support@lanternday.com. Please do not open a public issue for it.

Say what you found, where (a route, a page or a file), and how to reproduce it.

## Reproduce it locally

lanternday.com is not a test target. Every live day spends real money under caps that all visitors share, so please do not scan, fuzz or load it, or send its routes anything a visitor using the site would not. Reproduce on your own machine instead: the app runs with no keys (`pnpm install`, then `pnpm dev`; see the [README](README.md#getting-started)), and its tests run on mock models and recorded responses.

The threat model, what has been verified and the findings fixed so far are in [`docs/security.md`](docs/security.md).

## No bounty

Lantern is a one-person project, and it offers no bug bounty.
