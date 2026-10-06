import { useSyncExternalStore } from "react";
import { DEFAULT_THEME_PREF, isThemePref, type ResolvedTheme, type ThemePref } from "@/lib/theme";

export type DomTheme = ResolvedTheme;

function subscribeTo(attribute: string) {
	return (onChange: () => void): (() => void) => {
		const mo = new MutationObserver(onChange);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: [attribute] });
		return () => mo.disconnect();
	};
}

const subscribeTheme = subscribeTo("data-theme");
const subscribePref = subscribeTo("data-theme-pref");

// Match THEME_BOOT in app/layout.tsx: only the string "dark" is dark.
function readTheme(): DomTheme {
	return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function readPref(): ThemePref {
	const pref = document.documentElement.dataset.themePref;
	return isThemePref(pref) ? pref : DEFAULT_THEME_PREF;
}

/**
 * The live, resolved `data-theme` on <html>. The root layout is cookie-free,
 * so the server renders `serverTheme` (light by default) and the client
 * switches to the DOM value right after hydration.
 */
export function useDomTheme(serverTheme: DomTheme = "light"): DomTheme {
	return useSyncExternalStore(subscribeTheme, readTheme, () => serverTheme);
}

/** The live pick — `data-theme-pref` on <html> — which may be `system`. */
export function useThemePref(serverPref: ThemePref = DEFAULT_THEME_PREF): ThemePref {
	return useSyncExternalStore(subscribePref, readPref, () => serverPref);
}
