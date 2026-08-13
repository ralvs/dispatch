import { COLOR_SLUGS, type ColorSlug, colorSlugVar, isColorSlug } from "@/lib/schemas/color";

/**
 * A calendar event's colour on the day tape and in the Timeline.
 *
 * Events have no domain_id. When the calendar's name matches a stewardship
 * domain (case-insensitive), the event borrows that domain's live colour
 * slug — so retuning Engine on /domains retunes Engine events too. No match
 * (or a domain with no colour) falls back to hashing the calendar name into
 * the same nine palette slots, which keeps unmatched calendars distinct and
 * stable.
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

export type DomainColorSource = { name: string; color: string | null };

function namesMatch(a: string, b: string): boolean {
	return a.trim().localeCompare(b.trim(), undefined, { sensitivity: "accent" }) === 0;
}

/** Palette slug for an event, or null when there is no calendar name. */
export function eventColorSlug(
	calendarName: string | null | undefined,
	domains: readonly DomainColorSource[] = [],
): ColorSlug | null {
	if (!calendarName) return null;
	const match = domains.find((d) => namesMatch(d.name, calendarName));
	if (match && isColorSlug(match.color)) return match.color;
	return COLOR_SLUGS[hashSeed(calendarName) % COLOR_SLUGS.length];
}

/** A CSS colour for an event, stable for a given calendar name + domain map. */
export function eventColor(
	calendarName: string | null | undefined,
	domains: readonly DomainColorSource[] = [],
): string {
	const slug = eventColorSlug(calendarName, domains);
	return slug ? colorSlugVar(slug) : "var(--ink-3)";
}
