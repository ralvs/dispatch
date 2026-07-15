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
