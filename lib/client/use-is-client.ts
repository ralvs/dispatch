import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * `false` on the server and during hydration, `true` once on the client — so
 * a portal into `document` never makes the first client render differ from
 * the server HTML.
 */
export function useIsClient(): boolean {
	return useSyncExternalStore(
		subscribe,
		() => true,
		() => false,
	);
}
