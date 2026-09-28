#!/bin/bash
# SessionStart hook (.claude/settings.json): installs dependencies in a cloud
# session, so `bun run check` works from the first command. A local session
# exits at once — your own checkout manages its own node_modules.
#
# The cloud environment's setup script pins Bun; this installs the lockfile.
# A failed install never blocks the session: the output goes to Claude, which
# can retry or report it.

if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
	exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 0

if output="$(bun install --frozen-lockfile 2>&1)"; then
	echo "Dependencies installed (bun $(bun --version))."
else
	echo "bun install failed in the SessionStart hook. Last lines:"
	echo "$output" | tail -20
fi
exit 0
