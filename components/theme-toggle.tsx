"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { setTheme } from "@/app/theme-actions";
import { Icon } from "@/components/ui/icon";
import { runAction } from "@/lib/client/toast";

function readDomTheme(): "dark" | "light" {
	if (typeof document === "undefined") return "light";
	return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/**
 * Theme control. Seeds from `data-theme` on <html> (boot script or prior
 * toggle) — no server cookie read required (docs/adr/0033).
 */
export function ThemeToggle({ current }: { current?: "dark" | "light" }) {
	const [pending, startTransition] = useTransition();
	const [theme, setLocalTheme] = useState<"dark" | "light">(current ?? "light");
	const next = theme === "dark" ? "light" : "dark";

	// Reconcile to the live DOM after mount: SSR may not know the cookie
	// (root layout is cookie-free), and a client-router-cache remount can
	// re-seed a stale prop.
	useEffect(() => {
		const domTheme = readDomTheme();
		setLocalTheme((prev) => (prev === domTheme ? prev : domTheme));
	}, []);

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
				document.documentElement.dataset.theme = next;
				setLocalTheme(next);
				startTransition(async () => {
					await runAction(() => setTheme(next), "Couldn't switch theme.");
				});
			}}
			className="inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-[13px] font-semibold text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink active:translate-y-px"
		>
			<Icon icon={theme === "dark" ? Sun : Moon} size="sm" />
			{theme === "dark" ? "Light" : "Dark"}
		</button>
	);
}
