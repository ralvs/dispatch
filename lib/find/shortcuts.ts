export type ShortcutEvent = { key: string; metaKey: boolean; ctrlKey: boolean };

/** Cmd+K (macOS) or Ctrl+K (elsewhere) opens Find. Capture keeps Cmd+J. */
export function isFindShortcut(event: ShortcutEvent): boolean {
	return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
}
