#!/usr/bin/env bash
# Compile the EventKit bridge for the current Mac.
set -euo pipefail
cd "$(dirname "$0")"
swiftc -O \
	-framework EventKit \
	-framework Foundation \
	main.swift \
	-o calendar-bridge
echo "Built $(pwd)/calendar-bridge"
