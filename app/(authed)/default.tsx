import { notFound } from "next/navigation";

/**
 * The `children` slot of `(authed)` when nothing in it matches: not found,
 * exactly what Next's built-in default does. It exists only for the strict
 * route matching Next 16.4 turned on.
 *
 * The check pairs `@modal/[...catchAll]` with every URL, `/sign-in` and
 * `/oauth/consent` included, though neither page sits under this layout. It
 * then finds no `children` page or default here for them, calls the route
 * incomplete and drops it, so `next dev` served both pages as 404. The
 * production build was not affected. Delete this file once
 * https://github.com/vercel/next.js/issues/99830 is fixed.
 */
export default function AuthedDefault() {
	notFound();
}
