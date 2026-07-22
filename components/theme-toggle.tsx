"use client";

import { useTransition } from "react";
import { setTheme } from "@/app/theme-actions";
import { runAction } from "@/lib/client/toast";

export function ThemeToggle({ current }: { current: "dark" | "light" }) {
	const [pending, startTransition] = useTransition();
	const next = current === "dark" ? "light" : "dark";

	return (
		<button
			type="button"
			aria-label={`Switch to ${next} mode`}
			disabled={pending}
			onClick={() =>
				startTransition(async () => {
					await runAction(() => setTheme(next), "Couldn't switch theme.");
				})
			}
			className="font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:text-ink"
		>
			{current === "dark" ? "◐ Light" : "◑ Dark"}
		</button>
	);
}
