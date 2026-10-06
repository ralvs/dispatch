/**
 * Theme preference (docs/adr/0080). The pick is per device — a `theme` cookie —
 * and `system` follows the OS. <html> carries both halves: `data-theme-pref`
 * is the pick, `data-theme` is what it resolves to and what the CSS reads.
 *
 * THEME_BOOT in app/layout.tsx repeats this logic as a string, because it runs
 * before any bundle loads. Change both together.
 */
export const THEME_PREFS = ["light", "dark", "system"] as const;

export type ThemePref = (typeof THEME_PREFS)[number];
export type ResolvedTheme = Exclude<ThemePref, "system">;

/** A device with no cookie, or a cookie we do not know, follows the OS. */
export const DEFAULT_THEME_PREF: ThemePref = "system";

export const DARK_QUERY = "(prefers-color-scheme: dark)";

export function isThemePref(value: unknown): value is ThemePref {
	return typeof value === "string" && (THEME_PREFS as readonly string[]).includes(value);
}

export function resolveTheme(pref: ThemePref, prefersDark: boolean): ResolvedTheme {
	if (pref === "system") return prefersDark ? "dark" : "light";
	return pref;
}
