"use client";

export const OPEN_FIND_EVENT = "dispatch:open-find";

export function openFindPalette(): void {
	window.dispatchEvent(new CustomEvent(OPEN_FIND_EVENT));
}
