"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

/**
 * Sonner host. Theme follows `data-theme` on <html> (Dispatch light/dark).
 * Failure toasts only — callers use toastError / runAction.
 *
 * Pass 5 / B: light is the default (matches THEME_BOOT in app/layout.tsx —
 * anything that is not the string "dark" resolves to light). Surface card,
 * medium title, error border. Speaks in the app's operational English.
 */
export function AppToaster() {
	const [theme, setTheme] = useState<"dark" | "light">("light");

	useEffect(() => {
		function read() {
			const t = document.documentElement.getAttribute("data-theme");
			// Match THEME_BOOT: only the string "dark" is dark; everything else is light.
			setTheme(t === "dark" ? "dark" : "light");
		}
		read();
		const mo = new MutationObserver(read);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
		return () => mo.disconnect();
	}, []);

	return (
		<Toaster
			theme={theme}
			position="top-center"
			closeButton
			richColors={false}
			toastOptions={{
				classNames: {
					toast:
						"rounded-control border border-line-strong bg-surface text-ink elevation-overlay font-sans text-sm",
					title: "text-ink font-medium",
					description: "text-ink-2 text-[13px]",
					error: "border-error/40",
					closeButton: "border-line bg-surface text-ink-3",
				},
			}}
		/>
	);
}
