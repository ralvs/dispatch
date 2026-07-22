#!/usr/bin/env bash
# Install a launchd agent that runs the calendar bridge every 15 minutes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BIN="$ROOT/calendar-bridge"
LABEL="id.alves.dispatch.calendar-bridge"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="$HOME/Library/Logs/dispatch"
ENV_FILE="${DISPATCH_BRIDGE_ENV:-$HOME/.config/dispatch/calendar-bridge.env}"

if [[ ! -x "$BIN" ]]; then
	echo "Building bridge…"
	"$ROOT/build.sh"
fi

if [[ ! -f "$ENV_FILE" ]]; then
	mkdir -p "$(dirname "$ENV_FILE")"
	cat >"$ENV_FILE" <<'EOF'
# Required — fill in and chmod 600 this file
DISPATCH_BASE_URL=https://YOUR_DEPLOYMENT
CALENDAR_BRIDGE_SECRET=
# Exact Apple Calendar titles for Engine calendars (comma-separated).
# Run: ./calendar-bridge once without this set is not supported; list titles
# in Calendar.app sidebar, e.g. renan.alves@engine.com
DISPATCH_BRIDGE_CALENDAR_TITLES=
EOF
	chmod 600 "$ENV_FILE"
	echo "Created $ENV_FILE — fill in values, then re-run this script."
	exit 1
fi

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

: "${DISPATCH_BASE_URL:?set in $ENV_FILE}"
: "${CALENDAR_BRIDGE_SECRET:?set in $ENV_FILE}"
: "${DISPATCH_BRIDGE_CALENDAR_TITLES:?set in $ENV_FILE}"

mkdir -p "$LOG_DIR"

cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>${LABEL}</string>
	<key>ProgramArguments</key>
	<array>
		<string>/bin/bash</string>
		<string>-lc</string>
		<string>set -a; source '${ENV_FILE}'; set +a; exec '${BIN}'</string>
	</array>
	<key>StartInterval</key>
	<integer>900</integer>
	<key>RunAtLoad</key>
	<true/>
	<key>StandardOutPath</key>
	<string>${LOG_DIR}/calendar-bridge.out.log</string>
	<key>StandardErrorPath</key>
	<string>${LOG_DIR}/calendar-bridge.err.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl enable "gui/$(id -u)/${LABEL}"
launchctl kickstart -k "gui/$(id -u)/${LABEL}"

echo "Installed ${PLIST}"
echo "Logs: ${LOG_DIR}/calendar-bridge.*.log"
echo "Env:  ${ENV_FILE}"
