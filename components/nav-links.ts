export type NavItem = {
	key: string;
	label: string;
	href: string;
	// Paths that keep this tab highlighted even though they aren't under href.
	aliases?: string[];
};

// The 5-tab shell (content tab removed — docs/adr/0007). /tasks and /inbox
// are Today sub-views and keep Today highlighted.
export const TABS: NavItem[] = [
	{ key: "today", label: "Today", href: "/today", aliases: ["/tasks", "/inbox", "/calendar"] },
	{ key: "domains", label: "Domains", href: "/domains" },
	{ key: "projects", label: "Projects", href: "/projects" },
	{ key: "people", label: "People", href: "/people" },
	{ key: "library", label: "Library", href: "/library" },
];

// Desktop rail gets the full map.
export const RAIL_EXTRAS: NavItem[] = [
	{ key: "routines", label: "Routines", href: "/routines" },
	{ key: "health", label: "Health", href: "/health" },
	{ key: "journal", label: "Journal", href: "/journal" },
	{ key: "notes", label: "Notes", href: "/notes" },
	{ key: "quotes", label: "Quotes", href: "/quotes" },
];

export function isActive(item: NavItem, pathname: string): boolean {
	if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
	return (item.aliases ?? []).some((a) => pathname === a || pathname.startsWith(`${a}/`));
}
