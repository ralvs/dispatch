import { useSyncExternalStore } from "react";

export type DomTheme = "dark" | "light";

function subscribe(onChange: () => void): () => void {
	const mo = new MutationObserver(onChange);
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
	return () => mo.disconnect();
}

// Match THEME_BOOT in app/layout.tsx: only the string "dark" is dark.
function read(): DomTheme {
	return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/**
 * The live `data-theme` on <html>. The root layout is cookie-free, so the
 * server renders `serverTheme` (light by default) and the client switches to
 * the DOM value right after hydration.
 */
export function useDomTheme(serverTheme: DomTheme = "light"): DomTheme {
	return useSyncExternalStore(subscribe, read, () => serverTheme);
}
