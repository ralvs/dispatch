"use client";

import { Check, X } from "lucide-react";
import { Toaster } from "sonner";
import { Icon } from "@/components/ui/icon";
import { useDomTheme } from "@/lib/client/use-dom-theme";

/**
 * Sonner host. Theme follows `data-theme` on <html> (Dispatch light/dark).
 * Callers use toastError / toastSuccess / toastNotice / runAction.
 *
 * The slip: dock-pill geometry, overlay lift, 19px mark. Success is a green
 * filled tick; reopen is a neutral outline. Geometry lives in globals.css
 * because Sonner sets padding and radius with !important.
 */
export function AppToaster() {
	const theme = useDomTheme();

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
