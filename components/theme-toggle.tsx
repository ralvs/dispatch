"use client";

import { useTransition } from "react";
import { setTheme } from "@/app/theme-actions";
import { runAction } from "@/lib/client/toast";
import { useDomTheme } from "@/lib/client/use-dom-theme";

/**
 * Theme control. Reads the live `data-theme` on <html> (boot script or prior
 * toggle) — no server cookie read required (docs/adr/0033). Light is the
 * default, mirroring THEME_BOOT in app/layout.tsx; `current` only seeds the
 * server render, since the root layout is cookie-free.
 */
export function ThemeToggle({ current }: { current?: "dark" | "light" }) {
	const [pending, startTransition] = useTransition();
	const theme = useDomTheme(current);
	const next = theme === "dark" ? "light" : "dark";

	return (
		<button
			type="button"
			aria-label={`Switch to ${next} mode`}
			disabled={pending}
			onClick={() => {
				// Applied here rather than by revalidation: `data-theme` is set on
				// <html> by the boot script / this toggle, so revalidating any route
				// below it cannot repaint for someone standing on /today — and
				// this toggle lives in the always-visible desktop rail. The server
				// action's cookie write only has to survive until the next SSR.
				// Setting the attribute is also what re-renders this button.
				document.documentElement.dataset.theme = next;
				startTransition(async () => {
					await runAction(() => setTheme(next), "Couldn't switch theme.");
				});
			}}
			className="font-mono text-eyebrow uppercase tracking-widest text-ink-3 transition-opacity hover:text-ink active:opacity-70"
		>
			{theme === "dark" ? "◐ Light" : "◑ Dark"}
		</button>
	);
}
