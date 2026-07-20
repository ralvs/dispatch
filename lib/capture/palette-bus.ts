"use client";

// Decoupled open signal so triggers living in other components (the desktop
// rail, the mobile FAB) can raise the palette without a shared store or a
// provider wrapping the whole authed shell. The palette subscribes to this
// window event; anything that wants to open it dispatches one.

export const OPEN_CAPTURE_EVENT = "dispatch:open-capture";

/**
 * `prefill` seeds the textarea with a kind hint (the Today capture chips send
 * "Task: ", "Note: ", …) so the parser knows what it is reading. It is only
 * ever honoured on an empty palette — see the OPEN transition in
 * lib/capture/machine.ts.
 */
export function openCapturePalette(opts?: { voice?: boolean; prefill?: string }): void {
	window.dispatchEvent(
		new CustomEvent(OPEN_CAPTURE_EVENT, {
			detail: { voice: opts?.voice ?? false, prefill: opts?.prefill },
		}),
	);
}
