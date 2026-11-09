#!/usr/bin/env bash
# SessionStart hook: put the Node version from .nvmrc, and its corepack pnpm shim,
# first on PATH for every shell command Claude runs in this session.
# Why: Claude Code's shell snapshot keeps nvm's function but drops NVM_DIR, so an
# older system Node can win, and it has no pnpm.
# Never blocks a session: any problem means the hook does nothing.

[ -n "${CLAUDE_ENV_FILE:-}" ] || exit 0
project_dir="${CLAUDE_PROJECT_DIR:-$PWD}"
nvm_dir="${NVM_DIR:-$HOME/.nvm}"
[ -s "$nvm_dir/nvm.sh" ] && [ -s "$project_dir/.nvmrc" ] || exit 0

# shellcheck source=/dev/null
. "$nvm_dir/nvm.sh" --no-use
node_path="$(nvm which "$(cat "$project_dir/.nvmrc")" 2>/dev/null)" || exit 0
[ -x "$node_path" ] || exit 0

echo "export PATH=\"$(dirname "$node_path"):\$PATH\"" >> "$CLAUDE_ENV_FILE"
exit 0
