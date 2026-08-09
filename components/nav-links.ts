export type NavItem = {
	key: string;
	label: string;
	href: string;
	// Paths that keep this item highlighted even though they aren't under href.
	aliases?: string[];
};

// Three tiers (docs/adr/0014): Daily is the ops loop, Library is reference
// material the rail keeps behind a disclosure, System is chrome. Desktop
// renders all three; mobile promotes Daily-minus-Chat to tabs and hands the
// rest to /more.

// /calendar stays an alias — Today is the v1 calendar surface and the route is
// reserved for a dedicated page later (ADR-0014). /inbox is unassigned tasks,
// so it belongs to Tasks, not to Today.
const TODAY: NavItem = { key: "today", label: "Today", href: "/today", aliases: ["/calendar"] };
const TASKS: NavItem = { key: "tasks", label: "Tasks", href: "/tasks", aliases: ["/inbox"] };
const NOTES: NavItem = { key: "notes", label: "Notes", href: "/notes" };
const LINKS: NavItem = { key: "links", label: "Links", href: "/links" };
const CHAT: NavItem = { key: "chat", label: "Chat", href: "/chat" };

export const DAILY: NavItem[] = [TODAY, TASKS, NOTES, LINKS, CHAT];

export const LIBRARY: NavItem[] = [
	{ key: "projects", label: "Projects", href: "/projects" },
	{ key: "journal", label: "Journal", href: "/journal" },
	{ key: "routines", label: "Routines", href: "/routines" },
	{ key: "quotes", label: "Quotes", href: "/quotes" },
	{ key: "people", label: "People", href: "/people" },
	// Domains left /settings when the five-tab pressure that put them there
	// expired (Pass 4 / C4). They sit with Projects and People — records the
	// app keeps — not with Settings knobs.
	{ key: "domains", label: "Domains", href: "/domains" },
];

export const SYSTEM: NavItem[] = [
	{ key: "notifications", label: "Notifications", href: "/notifications" },
	{ key: "settings", label: "Settings", href: "/settings" },
];

// Destinations the More *menu* lists (not a /more page). Same three tiers as
// the old rail; Chat is Daily on desktop and in the menu on both.
export const MORE_SECTIONS: { title: string; items: NavItem[] }[] = [
	{ title: "Daily", items: [CHAT] },
	{ title: "Library", items: LIBRARY },
	{ title: "System", items: SYSTEM },
];

/** Every path the More menu reaches — used for the A1 active mark. */
export const MORE_HOSTED_HREFS: string[] = MORE_SECTIONS.flatMap((s) => s.items.map((i) => i.href));

// The 5-tab shell. More is a menu trigger, not a route (Pass 4 / C4). href is
// a stable key for isActive aliases only — navigation goes through the menu.
// A1: More stays lit for every destination it hosts so the bar always shows
// where you are.
export const TABS: NavItem[] = [
	TODAY,
	TASKS,
	NOTES,
	LINKS,
	{
		key: "more",
		label: "More",
		href: "/more",
		aliases: MORE_HOSTED_HREFS,
	},
];

export function isActive(item: NavItem, pathname: string): boolean {
	if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
	return (item.aliases ?? []).some((a) => pathname === a || pathname.startsWith(`${a}/`));
}

/** True when any item in the group owns the current path — used to keep the
 * rail's Library disclosure open on the page you are standing in. */
export function isGroupActive(items: NavItem[], pathname: string): boolean {
	return items.some((i) => isActive(i, pathname));
}
