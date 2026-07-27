// Pure keyboard predicates for the capture palette, split out so the modifier
// logic is unit-testable without a DOM. The component wires these to real
// KeyboardEvents.

export type ShortcutEvent = { key: string; metaKey: boolean; ctrlKey: boolean };

/** Cmd+J (macOS) or Ctrl+J (elsewhere) opens the palette from anywhere. */
export function isOpenShortcut(event: ShortcutEvent): boolean {
	return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j";
}

/** Cmd/Ctrl+Enter submits the current draft from within the textarea. */
export function isSubmitShortcut(event: ShortcutEvent): boolean {
	return (event.metaKey || event.ctrlKey) && event.key === "Enter";
}

export type NavShortcutEvent = {
	code: string;
	altKey: boolean;
	metaKey: boolean;
	ctrlKey: boolean;
};

/**
 * Option/Alt+1..5 jumps to a fixed tab index (0-4). On macOS, Option+1
 * produces the character "¡" rather than "1", so this matches on
 * event.code ("Digit1".."Digit5") instead of event.key.
 */
export function navShortcutIndex(event: NavShortcutEvent): number | null {
	if (!event.altKey || event.metaKey || event.ctrlKey) return null;
	const match = /^Digit([1-5])$/.exec(event.code);
	if (!match) return null;
	return Number(match[1]) - 1;
}
