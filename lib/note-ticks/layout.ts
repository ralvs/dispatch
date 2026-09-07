/** Grok.com dash geometry. A tick taller than this has become a scrollbar. */
export const TICK_MAX_PX = 8;
export const TICK_THICK_PX = 2;
export const TICK_THICK_ACTIVE_PX = 3;
export const TICK_WIDTH_PX = 16;
export const TICK_GAP_PX = 6;

export type TickRole = "Title" | "Heading" | "Paragraph" | "List";

export type TickSpec = {
	id: string;
	role: TickRole;
	preview: string;
};

export function roleForNodeName(name: string): TickRole | null {
	if (name === "heading") return "Heading";
	if (name === "paragraph") return "Paragraph";
	if (name === "bulletList" || name === "orderedList" || name === "taskList") return "List";
	if (name === "blockquote") return "Paragraph";
	return null;
}

export function previewFromText(text: string, max = 72): string {
	const compact = text.replace(/\s+/g, " ").trim();
	if (compact.length <= max) return compact;
	return `${compact.slice(0, max).trim()}…`;
}

/** Thickness only. Never a thumb. */
export function tickThickness(active: boolean): number {
	return active ? TICK_THICK_ACTIVE_PX : TICK_THICK_PX;
}
