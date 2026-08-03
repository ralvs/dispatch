"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

/** Breathing room kept between the panel and the viewport edge. */
const GUTTER = 8;

function IconLines({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 16 16"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M3.5 4.5h9M3.5 8h9M3.5 11.5h5.5" />
		</svg>
	);
}

/**
 * Peek at a task's own `notes` field without leaving the surface it's on.
 *
 * Deliberately a disclosure, not a dialog: it reveals text the row already
 * owns, so it takes no focus trap and nothing behind it goes inert. Focus
 * stays on the toggle, which is what makes Escape-to-close and repeat
 * keyboard use work without any focus bookkeeping.
 *
 * Distinct from the "¶ Note" chip beside it: that links to a *linked note*
 * (its own record on /notes), this shows the field written on the task.
 */
export function TaskNotePopover({ notes, title }: { notes: string; title: string }) {
	const [open, setOpen] = useState(false);
	const [shift, setShift] = useState(0);
	const panelId = useId();
	const wrapRef = useRef<HTMLSpanElement>(null);
	const panelRef = useRef<HTMLSpanElement>(null);

	// The glyph sits mid-row, so a panel anchored to it runs off the right edge
	// on a phone. Nudge it back inside after layout — CSS can't do this, since
	// the clamp depends on where the anchor happens to land. Measured before
	// paint so the panel never appears in the wrong place first.
	useLayoutEffect(() => {
		if (!open) {
			setShift(0);
			return;
		}
		const panel = panelRef.current;
		if (!panel) return;
		// Always measured at shift 0 — closing resets it above, so a correction
		// from a previous open can never compound onto this one.
		const rect = panel.getBoundingClientRect();
		const overflowRight = rect.right - (window.innerWidth - GUTTER);
		if (overflowRight <= 0) return;
		// Never trade a right-edge clip for a left-edge one.
		setShift(-Math.min(overflowRight, Math.max(rect.left - GUTTER, 0)));
	}, [open]);

	useEffect(() => {
		if (!open) return;

		function onPointerDown(e: PointerEvent) {
			if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
		}
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") setOpen(false);
		}
		// Capture phase: a row's title link or checkbox would otherwise swallow
		// the click that is meant to dismiss this.
		document.addEventListener("pointerdown", onPointerDown, true);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown, true);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	return (
		<span ref={wrapRef} className="relative inline-flex shrink-0 items-center">
			<button
				type="button"
				aria-label={open ? `Hide note on "${title}"` : `Show note on "${title}"`}
				aria-expanded={open}
				aria-controls={open ? panelId : undefined}
				onClick={() => setOpen((v) => !v)}
				// Same hit-area treatment as the ¶ chip next to it: the glyph stays
				// small, an after: pseudo-element does the reaching. Vertical reach is
				// kept under 44px because this sits in a flex-wrap meta row with no
				// row-gap, where a full expansion would overlap the line below.
				className={`relative inline-flex items-center rounded border px-1 py-px leading-none after:absolute after:-inset-y-3 after:-inset-x-1 after:content-[''] active:opacity-70 ${
					open
						? "border-line-strong text-ink"
						: "border-line text-ink-3 hover:border-line-strong hover:text-ink"
				}`}
			>
				<IconLines className="h-3 w-3" />
			</button>
			{open && (
				<span
					id={panelId}
					role="note"
					ref={panelRef}
					style={shift ? { transform: `translateX(${shift}px)` } : undefined}
					className="absolute left-0 top-full z-20 mt-1.5 block max-h-56 w-64 max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain whitespace-pre-wrap break-words border border-line-strong bg-surface px-3 py-2 text-left font-serif text-sm leading-relaxed text-ink-2 shadow-lg"
				>
					{notes}
				</span>
			)}
		</span>
	);
}
