"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

// Theme preference is UX state, not auth state — a cookie write here doesn't
// violate the proxy-is-sole-cookie-writer rule (that rule covers session
// cookies only; see docs/adr/0003).
export async function setTheme(theme: "dark" | "light") {
	const store = await cookies();
	store.set("theme", theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
	revalidatePath("/", "layout");
}
