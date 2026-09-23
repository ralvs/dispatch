/**
 * Cache tags for Next.js `"use cache"` entries (docs/adr/0033).
 * afterMutation invalidates these via revalidateTag(tag, "max").
 */
export const CacheTag = {
	/** Quotes, projects, routines stats, domains, alert counts. */
	todayDigest: "today-digest",
	/** Open tasks + calendar events for day bands (any date). */
	daySchedule: "day-schedule",
	tasks: "tasks",
	notes: "notes",
	links: "links",
	notifications: "notifications",
	routines: "routines",
	quotes: "quotes",
	journal: "journal",
	people: "people",
	projects: "projects",
	settings: "settings",
	/** Life domains: names, colours, cadence, archive state. */
	domains: "domains",
} as const;

export type CacheTagName = (typeof CacheTag)[keyof typeof CacheTag];
