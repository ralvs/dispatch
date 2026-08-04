"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

/**
 * Sonner host. Theme follows `data-theme` on <html> (Dispatch light/dark).
 * Failure toasts only — callers use toastError / runAction.
 */
export function AppToaster() {
	const [theme, setTheme] = useState<"dark" | "light">("dark");

	useEffect(() => {
		function read() {
			const t = document.documentElement.getAttribute("data-theme");
			setTheme(t === "light" ? "light" : "dark");
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
					description: "text-ink-2",
					error: "border-error/40",
					closeButton: "border-line bg-surface text-ink-3",
				},
			}}
		/>
	);
}
