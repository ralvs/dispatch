export type NavItem = {
	key: string;
	label: string;
	href: string;
	// Paths that keep this tab highlighted even though they aren't under href.
	aliases?: string[];
};

// The 5-tab shell (content tab removed — docs/adr/0007; library and domains
// tabs removed — docs/adr/0011). /tasks and /triage are Today sub-views and
// keep Today highlighted. Settings hosts domains and app-level toggles.
export const TABS: NavItem[] = [
	{ key: "today", label: "Today", href: "/today", aliases: ["/tasks", "/triage", "/calendar"] },
	{ key: "notes", label: "Notes", href: "/notes" },
	{ key: "projects", label: "Projects", href: "/projects" },
	{ key: "people", label: "People", href: "/people" },
	{ key: "settings", label: "Settings", href: "/settings", aliases: ["/notifications"] },
];

// Desktop rail gets the full map.
export const RAIL_EXTRAS: NavItem[] = [
	{ key: "chat", label: "Chat", href: "/chat" },
	{ key: "routines", label: "Routines", href: "/routines" },
	{ key: "journal", label: "Journal", href: "/journal" },
	{ key: "quotes", label: "Quotes", href: "/quotes" },
];

export function isActive(item: NavItem, pathname: string): boolean {
	if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
	return (item.aliases ?? []).some((a) => pathname === a || pathname.startsWith(`${a}/`));
}
