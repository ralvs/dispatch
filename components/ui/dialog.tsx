"use client";

import { type ReactNode, useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/lib/client/use-is-client";
import { tv, type VariantProps } from "./tv";

/**
 * The app's one modal shell: portalled overlay, focus trap, scroll lock,
 * `inert` on everything behind it, Escape and backdrop dismissal. Callers
 * supply the body (a `<form>`, usually) and get the chrome for free.
 *
 * Children are only mounted while `open` — every consumer so far seeds its
 * fields from props on open, so unmounting is what makes reopening a form
 * show fresh values rather than the last edit.
 */

const FOCUSABLE =
	'a[href],button:not([disabled]),textarea,input:not([disabled]),select,[tabindex]:not([tabindex="-1"])';

const overlay = tv({
	base: "fixed inset-0 z-50 flex justify-center overflow-y-auto bg-bg/80 backdrop-blur-sm",
	variants: {
		sheet: {
			false: "items-start px-4 py-[8vh]",
			// Below `lg` the panel is the screen, so the overlay holds it edge to
			// edge; from `lg` up it is the centred dialog again.
			true: "items-stretch lg:items-start lg:px-4 lg:py-[8vh]",
		},
	},
	defaultVariants: { sheet: false },
});

const panel = tv({
	base: "group/dialog flex w-full flex-col overflow-hidden bg-surface",
	variants: {
		size: {
			sm: "max-w-sm",
			md: "max-w-lg",
			lg: "max-w-2xl",
		},
		sheet: {
			false: "max-h-[85dvh] rounded-card border border-line-strong elevation-overlay",
			// `h-full` of a `fixed inset-0` overlay, never a viewport unit: an
			// installed iOS PWA resolves those against a stale viewport (see
			// .app-shell in app/globals.css). The safe-area insets go on the
			// header and footer, which are the parts that touch the edges.
			true: "h-full max-lg:max-w-none lg:h-auto lg:max-h-[85dvh] lg:rounded-card lg:border lg:border-line-strong lg:shadow-overlay",
		},
	},
	defaultVariants: {
		size: "md",
		sheet: false,
	},
});

export type DialogVariants = VariantProps<typeof panel>;

export function Dialog({
	open,
	onClose,
	title,
	/** Optional line under the title — context, not instruction. */
	description,
	size,
	/**
	 * Full screen below `lg`, the centred dialog from `lg` up. For a form long
	 * enough that a phone should give it the whole screen (the task form).
	 */
	sheet = false,
	children,
	className,
}: DialogVariants & {
	open: boolean;
	onClose: () => void;
	title: string;
	description?: string;
	children: ReactNode;
	className?: string;
}) {
	const overlayRef = useRef<HTMLDivElement>(null);
	const dialogRef = useRef<HTMLDivElement>(null);
	const titleId = useId();
	const descId = useId();

	// Portals need a DOM; this component renders inside RSC output that is also
	// serialised on the server, so wait for mount before reaching for `document`.
	const mounted = useIsClient();

	// Move focus in on open. Focus goes back to the trigger in the effect below,
	// which owns `inert`.
	useEffect(() => {
		if (!open) return;
		// After paint, so the first field exists to receive it.
		const frame = requestAnimationFrame(() => {
			const target =
				dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]") ??
				dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
			target?.focus();
			if (target instanceof HTMLInputElement) target.select();
		});
		return () => cancelAnimationFrame(frame);
	}, [open]);

	// Lock background scroll and `inert` the shell behind the modal, so the page
	// underneath is neither scrollable, clickable, nor reachable by screen
	// readers. Live regions stay out of it, or toasts raised while the dialog is
	// open would be hidden from assistive tech. Same contract as CapturePalette.
	//
	// This effect also returns focus to the trigger on close, because only it
	// knows when `inert` comes off: a browser will not focus an inert element,
	// and the trigger sits in the shell this effect made inert. The focus effect
	// above runs first, so the trigger still holds focus when it is read here.
	useEffect(() => {
		if (!open) return;
		const trigger = document.activeElement as HTMLElement | null;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		const siblings = Array.from(document.body.children).filter(
			(el): el is HTMLElement =>
				el instanceof HTMLElement &&
				el !== overlayRef.current &&
				!el.matches('[data-sonner-toaster], [aria-live], [role="status"], [role="alert"]'),
		);
		for (const el of siblings) el.setAttribute("inert", "");
		return () => {
			document.body.style.overflow = previousOverflow;
			for (const el of siblings) el.removeAttribute("inert");
			trigger?.focus();
		};
	}, [open]);

	const onKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			if (event.key === "Escape") {
				// Stop here rather than letting a parent (a row, a list) also read it.
				event.stopPropagation();
				event.preventDefault();
				onClose();
				return;
			}
			if (event.key !== "Tab" || !dialogRef.current) return;
			const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
			if (items.length === 0) return;
			const first = items[0];
			const last = items[items.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		},
		[onClose],
	);

	if (!mounted || !open) return null;

	return createPortal(
		// biome-ignore lint/a11y/noStaticElementInteractions: backdrop click is a convenience; Escape and the close button are the keyboard paths.
		<div ref={overlayRef} role="presentation" onClick={onClose} className={overlay({ sheet })}>
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={description ? descId : undefined}
				onClick={(event) => event.stopPropagation()}
				onKeyDown={onKeyDown}
				data-sheet={sheet || undefined}
				className={panel({ size, sheet, className })}
			>
				<div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 max-lg:group-data-sheet/dialog:pt-[calc(env(safe-area-inset-top)+1rem)]">
					<div className="min-w-0">
						<h2
							id={titleId}
							className="font-mono text-eyebrow uppercase tracking-widest text-ink-3"
						>
							{title}
						</h2>
						{description && (
							<p id={descId} className="mt-1 text-meta text-ink-4">
								{description}
							</p>
						)}
					</div>
					<button
						type="button"
						aria-label={`Close ${title.toLowerCase()}`}
						onClick={onClose}
						className="shrink-0 font-mono text-eyebrow uppercase tracking-widest text-ink-3 transition-opacity hover:text-ink active:opacity-70"
					>
						Esc
					</button>
				</div>
				{children}
			</div>
		</div>,
		document.body,
	);
}

/** Scrollable body — the part that gives when the viewport is short. */
export function DialogBody({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return <div className={`min-h-0 flex-1 overflow-y-auto px-5 py-4 ${className}`}>{children}</div>;
}

/** Pinned footer: destructive left, primary rightmost. */
export function DialogFooter({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`flex flex-wrap items-center gap-2 border-t border-line px-5 py-3 max-lg:group-data-sheet/dialog:pb-[calc(env(safe-area-inset-bottom)+0.75rem)] ${className}`}
		>
			{children}
		</div>
	);
}
