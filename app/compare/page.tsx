"use client";

import { useEffect, useState } from "react";
import { LineDepthDesign } from "./designs/variants";
import { DAY } from "./mock";

// Bake-off concluded: Line · Depth shipped (ADR 0039). This route remains as
// a living gallery of the primitives until the migration is fully absorbed.

const WIDTHS = { phone: 402, desktop: 1180 } as const;

export default function ComparePage() {
	const [viewport, setViewport] = useState<keyof typeof WIDTHS>("phone");
	const [theme, setTheme] = useState<"dark" | "light">("dark");

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			const el = e.target as HTMLElement | null;
			if (el?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? "")) return;
			if (e.key === "t" || e.key === "T") {
				setTheme((t) => (t === "dark" ? "light" : "dark"));
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	useEffect(() => {
		const prev = document.documentElement.getAttribute("data-theme");
		document.documentElement.setAttribute("data-theme", theme);
		return () => {
			if (prev) document.documentElement.setAttribute("data-theme", prev);
			else document.documentElement.removeAttribute("data-theme");
		};
	}, [theme]);

	return (
		<div className="min-h-dvh bg-neutral-100 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
			<header className="sticky top-0 z-10 border-b border-neutral-300 bg-neutral-100/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
				<div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
					<span className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-500">
						Shipped · Line · Depth · T theme
					</span>

					<button
						type="button"
						onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
						className="rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-neutral-600 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-800"
						aria-keyshortcuts="T"
					>
						{theme}
					</button>

					<fieldset className="ml-auto flex gap-1" aria-label="Viewport">
						{(Object.keys(WIDTHS) as (keyof typeof WIDTHS)[]).map((v) => (
							<button
								key={v}
								type="button"
								onClick={() => setViewport(v)}
								aria-current={v === viewport}
								className={`rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition ${
									v === viewport
										? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
										: "text-neutral-600 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-800"
								}`}
							>
								{v}
							</button>
						))}
					</fieldset>
				</div>
				<p className="mx-auto max-w-[1400px] px-5 pb-3 text-sm text-neutral-500">
					Line fields · subtle depth elevation · ADR 0039. Tokens live on :root.
				</p>
			</header>

			<div className="flex justify-center px-5 py-8">
				<div
					className="w-full overflow-hidden rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.08),0_12px_40px_rgba(0,0,0,0.12)]"
					style={{ maxWidth: WIDTHS[viewport], containerType: "inline-size" }}
				>
					<LineDepthDesign day={DAY} />
				</div>
			</div>
		</div>
	);
}
