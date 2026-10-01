"use client";

import { toggleMoreMenu } from "@/lib/more-menu-bus";
import { BACK_LINK_CLASS } from "./back-link";

/**
 * `← More` on every page the More menu hosts (ADR-0068). More is a menu, not a
 * route, so this is a button that opens the menu — the list you came from.
 * Shown at every width: the desktop header carries the same menu.
 */
export function MoreBackLink() {
	return (
		<nav aria-label="Breadcrumb" className="pb-4">
			<button
				type="button"
				aria-haspopup="dialog"
				onClick={() => toggleMoreMenu()}
				className={`${BACK_LINK_CLASS} cursor-pointer`}
			>
				← More
			</button>
		</nav>
	);
}
