"use client";

// Decoupled open signal so triggers living in other components (the desktop
// rail, the mobile FAB) can raise the palette without a shared store or a
// provider wrapping the whole authed shell. The palette subscribes to this
// window event; anything that wants to open it dispatches one.

export const OPEN_CAPTURE_EVENT = "dispatch:open-capture";

export function openCapturePalette(opts?: { voice?: boolean }): void {
	window.dispatchEvent(
		new CustomEvent(OPEN_CAPTURE_EVENT, { detail: { voice: opts?.voice ?? false } }),
	);
}
