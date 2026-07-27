"use client";

import { useState, useTransition } from "react";
import { setTheme } from "@/app/theme-actions";
import { runAction } from "@/lib/client/toast";

export function ThemeToggle({ current }: { current: "dark" | "light" }) {
	const [pending, startTransition] = useTransition();
	const [theme, setLocalTheme] = useState(current);
	const next = theme === "dark" ? "light" : "dark";

	return (
		<button
			type="button"
			aria-label={`Switch to ${next} mode`}
			disabled={pending}
			onClick={() => {
				// Applied here rather than by revalidation: `data-theme` is set on
				// <html> by the ROOT layout, so revalidating any route below it
				// cannot repaint the page for someone standing on /today — and
				// this toggle lives in the always-visible desktop rail. The server
				// action's cookie write only has to survive until the next SSR.
				document.documentElement.dataset.theme = next;
				setLocalTheme(next);
				startTransition(async () => {
					await runAction(() => setTheme(next), "Couldn't switch theme.");
				});
			}}
			className="font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:text-ink"
		>
			{theme === "dark" ? "◐ Light" : "◑ Dark"}
		</button>
	);
}
