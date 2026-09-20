"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * A nav link that prefetches on intent.
 *
 * Next's default (`prefetch="auto"`) prefetches a route's static shell when the
 * link scrolls into view, and stops there — clicking still waits on the whole
 * server fan-out. `prefetch={true}` would fetch the data too, but putting that
 * on five tabs means five full page renders on every page load: the cold-start
 * burst docs/adr/0032 is about, and on a phone the worst possible moment for it.
 *
 * So: keep the cheap viewport prefetch, and upgrade to the full one the moment
 * you point at a tab. Hover on a pointer, first touch on a phone, focus on a
 * keyboard — each is a few hundred milliseconds of warning, which is most of
 * what the read costs now. The app pays for the one route you are about to
 * open, a moment before you open it.
 *
 * This is the stable spelling of Next's `unstable_dynamicOnHover`, which its
 * own docs describe as "effectively the same as updating the prefetch prop to
 * `true` in a mouse event". That prop is not on the public `next/link` type.
 *
 * Warming is one-way on purpose: a prefetched route stays prefetched, and
 * flipping back on mouse-out would only throw the work away.
 */
export function IntentLink({
	href,
	children,
	...rest
}: Omit<React.ComponentProps<typeof Link>, "prefetch">) {
	const [warm, setWarm] = useState(false);
	const heat = () => setWarm(true);

	return (
		<Link
			href={href}
			prefetch={warm ? true : undefined}
			onMouseEnter={heat}
			onTouchStart={heat}
			onFocus={heat}
			{...rest}
		>
			{children}
		</Link>
	);
}
