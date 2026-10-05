"use client";

import { usePathname, useSelectedLayoutSegment } from "next/navigation";

/**
 * The path the nav lights. Usually the pathname. Not while a task is open over
 * a page (docs/adr/0079): the address is then the task's own, `/tasks/<id>`,
 * but the page behind the dialog is the one you were on, and lighting Tasks
 * would say you had left it. Then it is only that page's top-level path
 * (`/projects`, not `/projects/<id>`), which is all a tab needs.
 *
 * Call it from a client component the `(authed)` layout renders: the segment
 * is read one level below that layout, from `children`, which keeps naming the
 * page underneath while `@modal` holds the task. When the address starts
 * somewhere else, the address belongs to the dialog.
 */
export function usePagePathname(): string {
	const pathname = usePathname();
	const page = useSelectedLayoutSegment();
	if (!page || pathname === `/${page}` || pathname.startsWith(`/${page}/`)) return pathname;
	return `/${page}`;
}
