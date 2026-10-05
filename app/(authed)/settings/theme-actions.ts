"use server";

import { cookies } from "next/headers";
import { requireOwnerPage } from "@/lib/auth";
import { afterMutation } from "@/lib/invalidate";
import { isThemePref, type ThemePref } from "@/lib/theme";

// Theme preference is UX state, not auth state — a cookie write here doesn't
// violate the proxy-is-sole-cookie-writer rule (that rule covers session
// cookies only; see docs/adr/0003). A cookie, not app_settings, because the
// pick is per device (docs/adr/0080).
export async function setTheme(pref: ThemePref) {
	await requireOwnerPage();
	if (!isThemePref(pref)) throw new Error(`Unknown theme: ${String(pref)}`);
	const store = await cookies();
	store.set("theme", pref, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
	afterMutation("theme");
}
