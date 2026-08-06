"use client";

import { X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icon";
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

const panel = tv({
	base: "flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-card border border-line bg-surface elevation-overlay",
	variants: {
		size: {
			sm: "max-w-sm",
			md: "max-w-lg",
			lg: "max-w-2xl",
		},
	},
	defaultVariants: {
		size: "md",
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
	const restoreFocusRef = useRef<HTMLElement | null>(null);
	const titleId = useId();
	const descId = useId();

	// Portals need a DOM; this component renders inside RSC output that is also
	// serialised on the server, so wait for mount before reaching for `document`.
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	// Move focus in on open, back to the trigger on close.
	useEffect(() => {
		if (!open) return;
		restoreFocusRef.current = document.activeElement as HTMLElement | null;
		// After paint, so the first field exists to receive it.
		const frame = requestAnimationFrame(() => {
			const target =
				dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]") ??
				dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
			target?.focus();
			if (target instanceof HTMLInputElement) target.select();
		});
		return () => {
			cancelAnimationFrame(frame);
			restoreFocusRef.current?.focus();
		};
	}, [open]);

	// Lock background scroll and `inert` the shell behind the modal, so the page
	// underneath is neither scrollable, clickable, nor reachable by screen
	// readers. Live regions stay out of it, or toasts raised while the dialog is
	// open would be hidden from assistive tech. Same contract as CapturePalette.
	useEffect(() => {
		if (!open) return;
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
		<div
			ref={overlayRef}
			role="presentation"
			onClick={onClose}
			className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg/80 px-4 py-[8vh] backdrop-blur-sm"
		>
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={description ? descId : undefined}
				onClick={(event) => event.stopPropagation()}
				onKeyDown={onKeyDown}
				className={panel({ size, className })}
			>
				<div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
					<div className="min-w-0">
						<h2 id={titleId} className="font-serif text-lg text-ink">
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
						className="-mr-1.5 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink active:translate-y-px"
					>
						<Icon icon={X} size="sm" />
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
	return <div className={`min-h-0 flex-1 overflow-y-auto px-6 py-5 ${className}`}>{children}</div>;
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
			className={`flex flex-wrap items-center gap-2 border-t border-line px-6 py-4 ${className}`}
		>
			{children}
		</div>
	);
}
