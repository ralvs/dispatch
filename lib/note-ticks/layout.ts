/** Grok.com dash geometry. A tick taller than this has become a scrollbar. */
export const TICK_MAX_PX = 8;
export const TICK_THICK_PX = 2;
export const TICK_THICK_ACTIVE_PX = 3;
export const TICK_WIDTH_PX = 14;
export const TICK_WIDTH_ACTIVE_PX = 24;
export const TICK_GAP_PX = 6;

/** One dash plus its gap. The rail's vertical pitch. */
export const TICK_ROW_PX = TICK_THICK_ACTIVE_PX + TICK_GAP_PX;

/**
 * Where the rail reads the note. The dash that owns the block crossing this
 * fraction of the scroller is the active one — slightly above centre, which is
 * where the eye sits while reading.
 */
export const READING_LINE_RATIO = 0.35;

/** Fewer dashes than this and the rail is noise, not navigation. */
export const TICK_MIN_WINDOW = 4;

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

/** The active dash is longer, the way Grok's is. */
export function tickWidth(active: boolean): number {
	return active ? TICK_WIDTH_ACTIVE_PX : TICK_WIDTH_PX;
}

/** How many dashes fit in `height` px of rail. */
export function maxTicksForHeight(height: number): number {
	return Math.max(TICK_MIN_WINDOW, Math.floor(height / TICK_ROW_PX));
}

/**
 * A long note has more blocks than the rail is tall. Show a window centred on
 * the active dash, clamped so the first and last blocks are reachable.
 */
export function tickWindow(
	total: number,
	active: number,
	max: number,
): { start: number; end: number } {
	if (total <= max) return { start: 0, end: total };
	const half = Math.floor(max / 2);
	const start = Math.max(0, Math.min(active - half, total - max));
	return { start, end: start + max };
}

/**
 * Index of the block that owns the reading line, given scroll state.
 *
 * `scrollHeight` closes the tail: the last blocks sit below the reading line
 * even at maximum scroll, so the bottom of the note claims the last dash.
 * Without it the final dashes could never light up.
 */
export function activeIndexForScroll(
	tops: number[],
	scrollTop: number,
	clientHeight: number,
	scrollHeight?: number,
): number {
	if (tops.length === 0) return 0;
	if (scrollHeight !== undefined && scrollTop + clientHeight >= scrollHeight - 2) {
		return tops.length - 1;
	}
	const line = scrollTop + clientHeight * READING_LINE_RATIO;
	let index = 0;
	for (let i = 0; i < tops.length; i++) {
		if (tops[i] <= line) index = i;
		else break;
	}
	return index;
}

/**
 * Does the run of blocks the rail indexes overflow the scroller?
 *
 * Measured across the blocks themselves, not the article: the article also
 * carries the source line, the domain select and the Delete button, and a
 * two-paragraph note should not grow a rail because its chrome overflowed.
 */
export function blocksOverflow(spanPx: number, clientHeight: number): boolean {
	return spanPx > clientHeight - 24;
}

/** Scroll offset that parks `top` on the reading line. */
export function scrollTopForTick(top: number, clientHeight: number): number {
	return Math.max(0, top - clientHeight * READING_LINE_RATIO + 2);
}
