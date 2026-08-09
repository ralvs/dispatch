import { redirect } from "next/navigation";

/**
 * /more is no longer a page (Pass 4 / C4). More is a menu. Old bookmarks and
 * deep links land on Today rather than 404.
 */
export default function MoreRedirect() {
	redirect("/today");
}
