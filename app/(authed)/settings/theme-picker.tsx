"use client";

import { useTransition } from "react";
import { runAction } from "@/lib/client/toast";
import { useThemePref } from "@/lib/client/use-dom-theme";
import { DARK_QUERY, resolveTheme, THEME_PREFS, type ThemePref } from "@/lib/theme";
import { setTheme } from "./theme-actions";

const LABELS: Record<ThemePref, string> = { light: "Light", dark: "Dark", system: "System" };

/**
 * Theme control: Light, Dark or System, for this device only (docs/adr/0080).
 * Reads the live `data-theme-pref` on <html> (boot script or a prior pick) —
 * no server cookie read required (docs/adr/0033).
 */
export function ThemePicker() {
	const [pending, startTransition] = useTransition();
	const current = useThemePref();

	function pick(pref: ThemePref) {
		// Applied here rather than by revalidation: the attributes live on
		// <html>, which no route below it can repaint. The boot script's media
		// listener reads `data-theme-pref`, so System keeps following the OS
		// from here on. The cookie only has to survive until the next load.
		const root = document.documentElement;
		root.dataset.themePref = pref;
		root.dataset.theme = resolveTheme(pref, matchMedia(DARK_QUERY).matches);
		startTransition(async () => {
			await runAction(() => setTheme(pref), "Couldn't switch theme.");
		});
	}

	return (
		<div>
			<fieldset className="flex gap-4">
				<legend className="sr-only">Theme</legend>
				{THEME_PREFS.map((pref) => {
					const active = pref === current;
					return (
						<button
							key={pref}
							type="button"
							aria-pressed={active}
							disabled={pending}
							onClick={() => pick(pref)}
							className={`font-mono text-eyebrow uppercase tracking-widest transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-70 ${
								active
									? "text-ink underline decoration-ink decoration-2 underline-offset-4"
									: "text-ink-3"
							}`}
						>
							{LABELS[pref]}
						</button>
					);
				})}
			</fieldset>
			<p className="mt-1 font-mono text-meta text-ink-4">Saved on this device only.</p>
		</div>
	);
}
