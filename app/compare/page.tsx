"use client";

import { useState } from "react";
import { LedgerDesign } from "./designs/ledger";
import { LedgerNoirDesign } from "./designs/ledger-noir";
import { NightdeskDesign } from "./designs/nightdesk";
import { DAY } from "./mock";

// Temporary bake-off surface. Round 3: "Ledger" is the candidate — Ledger
// Noir's structure re-expressed in the app's real design system, with
// Nightdesk's two-column split. The other two stay as reference. Delete the
// route once the direction ships.

const DESIGNS = [
	{
		id: "ledger",
		name: "Ledger",
		note: "The candidate — Ledger Noir on the app's own tokens: real checkboxes, icons, day tape, two columns",
		Component: LedgerDesign,
	},
	{
		id: "ledger-noir",
		name: "Ledger Noir",
		note: "Round-2 winner, kept for reference — Swiss ruled ledger on a slate-blue night ground",
		Component: LedgerNoirDesign,
	},
	{
		id: "nightdesk",
		name: "Nightdesk",
		note: "Reference for the two-column editorial layout — the newspaper's night edition",
		Component: NightdeskDesign,
	},
] as const;

const WIDTHS = { phone: 402, desktop: 1180 } as const;

export default function ComparePage() {
	const [active, setActive] = useState<string>(DESIGNS[0].id);
	const [viewport, setViewport] = useState<keyof typeof WIDTHS>("phone");

	const current = DESIGNS.find((d) => d.id === active) ?? DESIGNS[0];
	const { Component } = current;

	return (
		<div className="min-h-dvh bg-neutral-100 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
			<header className="sticky top-0 z-10 border-b border-neutral-300 bg-neutral-100/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
				<div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
					<span className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-500">
						Today · {DESIGNS.length} directions
					</span>

					<nav className="flex flex-wrap gap-1" aria-label="Design directions">
						{DESIGNS.map((d, i) => (
							<button
								key={d.id}
								type="button"
								onClick={() => setActive(d.id)}
								aria-current={d.id === active}
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
