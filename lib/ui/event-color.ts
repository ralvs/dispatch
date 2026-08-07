import { COLOR_SLUGS, colorSlugVar } from "@/lib/schemas/color";

/**
 * A calendar event's colour on the day tape and in the Timeline.
 *
 * The comps colour every block by **domain**, but a calendar event has no
 * domain in this app — it has a `calendar_name` and nothing else that carries
 * meaning. Rather than draw half the day grey, an event takes its colour from
 * the calendar it came from, hashed into the same nine palette slots the
 * domains use.
 *
 * That is a real distinction, not a decoration: an operator with a work
 * calendar and a family calendar reads two stable colours on the tape, and
 * the assignment never moves because the hash is over the name.
 *
 * It does mean a calendar and a domain can land on the same slot. The shape
 * already separates them — an event is a filled block, a scheduled task an
 * outlined tick — so the colour is never the only thing telling them apart.
 *
 * djb2 with the murmur3 finalizer, matching lib/services/today.ts's
 * `hashSeed`: djb2 alone clusters low bits for short, similar inputs, which
 * calendar names are.
 */
function hashSeed(str: string): number {
	let h = 5381;
	for (let i = 0; i < str.length; i++) {
		h = (h * 33 + str.charCodeAt(i)) | 0;
	}
	h ^= h >>> 16;
	h = Math.imul(h, 0x85ebca6b);
	h ^= h >>> 13;
	h = Math.imul(h, 0xc2b2ae35);
	h ^= h >>> 16;
	return Math.abs(h);
}

/** A CSS colour for an event, stable for a given calendar name. */
export function eventColor(calendarName: string | null | undefined): string {
	if (!calendarName) return "var(--ink-3)";
	return colorSlugVar(COLOR_SLUGS[hashSeed(calendarName) % COLOR_SLUGS.length]);
}
