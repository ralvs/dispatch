"use client";

import { useEffect, useState } from "react";
import { BoxDepthDesign, BoxFlatDesign, LineDepthDesign, LineFlatDesign } from "./designs/variants";
import { DAY } from "./mock";

// Temporary bake-off surface. Round 7: field × elevation are orthogonal.
// Old designs (current/ledger/mixed) stay on disk for one-line revert.
// Delete the route once a winner ships.

const DESIGNS = [
	{
		id: "line",
		name: "Line",
		note: "Bottom-line fields · flat — no lift",
		Component: LineFlatDesign,
	},
	{
		id: "box",
		name: "Box",
		note: "Boxed fields · flat — hairlines only",
		Component: BoxFlatDesign,
	},
	{
		id: "line-depth",
		name: "Line · Depth",
		note: "Bottom-line fields · subtle lift on cards / dialog / popovers (fields stay clean)",
		Component: LineDepthDesign,
	},
	{
		id: "box-depth",
		name: "Box · Depth",
		note: "Boxed fields · subtle lift on fields + cards / dialog / popovers",
		Component: BoxDepthDesign,
	},
] as const;

const WIDTHS = { phone: 402, desktop: 1180 } as const;

export default function ComparePage() {
	const [active, setActive] = useState<string>(DESIGNS[0].id);
	const [viewport, setViewport] = useState<keyof typeof WIDTHS>("phone");
	const [theme, setTheme] = useState<"dark" | "light">("dark");

	// 1/2/3 switch designs — the whole point of this page is flipping between
	// them fast. Ignored while typing into one of the designs' own controls.
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			const el = e.target as HTMLElement | null;
			if (el?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? "")) return;
			const design = DESIGNS[Number(e.key) - 1];
			if (design) setActive(design.id);
			if (e.key === "t" || e.key === "T") {
				setTheme((t) => (t === "dark" ? "light" : "dark"));
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	// Sync bake-off theme onto <html> so data-theme tokens resolve correctly
	// inside the frame (app uses data-theme on html, not a local class).
	useEffect(() => {
		const prev = document.documentElement.getAttribute("data-theme");
		document.documentElement.setAttribute("data-theme", theme);
		return () => {
			if (prev) document.documentElement.setAttribute("data-theme", prev);
			else document.documentElement.removeAttribute("data-theme");
		};
	}, [theme]);

	const current = DESIGNS.find((d) => d.id === active) ?? DESIGNS[0];
	const { Component } = current;

	return (
		<div className="min-h-dvh bg-neutral-100 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
			<header className="sticky top-0 z-10 border-b border-neutral-300 bg-neutral-100/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
				<div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
					<span className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-500">
						UI · {DESIGNS.length} variants · 1–{DESIGNS.length} · T theme
					</span>

					<nav className="flex flex-wrap gap-1" aria-label="Design directions">
						{DESIGNS.map((d, i) => (
							<button
								key={d.id}
								type="button"
								onClick={() => setActive(d.id)}
								aria-current={d.id === active}
								aria-keyshortcuts={String(i + 1)}
								title={`Press ${i + 1}`}
								className={`rounded-md px-3 py-1.5 text-sm transition ${
									d.id === active
										? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
										: "text-neutral-600 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-800"
								}`}
							>
								<span className="font-mono text-[11px] opacity-60">{i + 1}</span> {d.name}
							</button>
						))}
					</nav>

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
				<p className="mx-auto max-w-[1400px] px-5 pb-3 text-sm text-neutral-500">{current.note}</p>
			</header>

			<div className="flex justify-center px-5 py-8">
				<div
					className="w-full overflow-hidden rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.08),0_12px_40px_rgba(0,0,0,0.12)]"
					style={{ maxWidth: WIDTHS[viewport], containerType: "inline-size" }}
				>
					<Component day={DAY} />
				</div>
			</div>
		</div>
	);
}
