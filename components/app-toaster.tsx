"use client";

import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { Icon } from "@/components/ui/icon";

/**
 * Sonner host. Theme follows `data-theme` on <html> (Dispatch light/dark).
 * Callers use toastError / toastSuccess / toastNotice / runAction.
 *
 * The slip: dock-pill geometry, overlay lift, 19px mark. Success is a green
 * filled tick; reopen is a neutral outline. Geometry lives in globals.css
 * because Sonner sets padding and radius with !important.
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
			icons={{
				success: <Icon icon={Check} size="sm" strokeWidth={2.25} />,
				error: <Icon icon={X} size="sm" strokeWidth={2.25} />,
				close: <Icon icon={X} size="sm" />,
			}}
			toastOptions={{
				classNames: {
					toast: "font-sans text-sm text-ink",
					title: "text-ink font-medium",
					description: "font-mono text-meta text-ink-3",
					closeButton: "border-line bg-surface text-ink-3",
				},
			}}
		/>
	);
}
