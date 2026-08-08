"use client";

import { AlignLeft } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { NOTE_CHIP_CLASS } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";

/** Breathing room kept between the panel and the viewport edge. */
const GUTTER = 8;

/**
 * Peek at a task's own `notes` field without leaving the surface it's on.
 *
 * Deliberately a disclosure, not a dialog: it reveals text the row already
 * owns, so it takes no focus trap and nothing behind it goes inert. Focus
 * stays on the toggle, which is what makes Escape-to-close and repeat
 * keyboard use work without any focus bookkeeping.
 *
 * Distinct from the page glyph beside it: that links to a *linked note*
 * (its own record on /notes) and uses FileText. This one is AlignLeft —
 * three lines for the notes written *on* the task itself.
 */
export function TaskNotePopover({ notes, title }: { notes: string; title: string }) {
	const [open, setOpen] = useState(false);
	const [shift, setShift] = useState(0);
	const panelId = useId();
	const wrapRef = useRef<HTMLSpanElement>(null);
	const panelRef = useRef<HTMLSpanElement>(null);

	// The panel hangs off the right of a glyph that itself sits at the right of
	// the row, so on a narrow viewport it runs past the left edge instead.
	// Nudge it back inside after layout — CSS can't do this, since the clamp
	// depends on where the anchor happens to land. Measured before paint so the
	// panel never appears in the wrong place first, and re-measured on resize
	// (rotating a phone with one open) rather than left stale.
	useLayoutEffect(() => {
		if (!open) {
			setShift(0);
			return;
		}

		function clamp() {
			const panel = panelRef.current;
			if (!panel) return;
			// Back out the correction already applied, so the maths describes
			// where the panel *would* sit unshifted. That is what makes this
			// idempotent — a re-run must not stack a second shift on the first.
			const rect = panel.getBoundingClientRect();
			const left = rect.left - shift;
			const right = rect.right - shift;
			const overflowLeft = GUTTER - left;
			const overflowRight = right - (window.innerWidth - GUTTER);
			// Both at once would mean the panel is wider than the viewport
			// allows; max-width prevents that, so each branch clamps its own edge
			// without ever trading it for a clip on the other.
			if (overflowLeft > 0) setShift(Math.min(overflowLeft, Math.max(-overflowRight, 0)));
			else if (overflowRight > 0) setShift(-Math.min(overflowRight, Math.max(left - GUTTER, 0)));
			else setShift(0);
		}

		clamp();
		window.addEventListener("resize", clamp);
		return () => window.removeEventListener("resize", clamp);
	}, [open, shift]);

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
				// Icon-only, so a native tooltip carries on hover what the label
				// carries to a screen reader.
				title="Note on this task"
				aria-expanded={open}
				aria-controls={open ? panelId : undefined}
				onClick={() => setOpen((v) => !v)}
				// While open the chip holds the emphasized border rather than waiting
				// for hover — with no text label, that outline is the only thing
				// tying the panel back to the control that opened it.
				className={`${NOTE_CHIP_CLASS} ${open ? "border-line-strong text-ink" : ""}`}
			>
				<Icon icon={AlignLeft} size="sm" />
			</button>
			{open && (
				<span
					id={panelId}
					role="note"
					ref={panelRef}
					style={shift ? { transform: `translateX(${shift}px)` } : undefined}
					// Right-anchored: the glyph lives in the row's right-hand control
					// column, so the panel opens back across the row rather than out
					// past the page edge.
					className="absolute right-0 top-full z-20 mt-1.5 block max-h-56 w-64 max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain whitespace-pre-wrap break-words rounded-control border border-line-strong bg-surface px-3 py-2 text-left type-title text-sm leading-relaxed text-ink-2 elevation-overlay"
				>
					{notes}
				</span>
			)}
		</span>
	);
}
