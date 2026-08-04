"use client";

import { ChevronRight } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";

const STORAGE_KEY = "dispatch:library-open";

/**
 * The rail's Library disclosure (ADR-0014). Collapsed by default so the daily
 * loop owns the top of the rail. Two things reopen it: the remembered flag in
 * localStorage, read after mount because the server render cannot see it, and
 * standing on a Library page — never hide the section you are already in.
 */
export function LibraryNav({
	hasActiveChild,
	children,
}: {
	hasActiveChild: boolean;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(hasActiveChild);

	useEffect(() => {
		if (hasActiveChild || window.localStorage.getItem(STORAGE_KEY) === "true") setOpen(true);
	}, [hasActiveChild]);

	function toggle() {
		setOpen((prev) => {
			const next = !prev;
			window.localStorage.setItem(STORAGE_KEY, String(next));
			return next;
		});
	}

	return (
		<div>
			<button
				type="button"
				onClick={toggle}
				aria-expanded={open}
				aria-controls="rail-library"
				className="flex w-full items-center gap-1.5 py-1.5 font-mono text-eyebrow uppercase tracking-widest text-ink-4 transition-opacity hover:text-ink-2 active:opacity-70"
			>
				<span
					aria-hidden="true"
					className={`inline-flex transition-transform ${open ? "rotate-90" : ""}`}
				>
					<Icon icon={ChevronRight} size="sm" />
				</span>
				Library
			</button>
			<div id="rail-library" hidden={!open}>
				{children}
			</div>
		</div>
	);
}
