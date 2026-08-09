"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isActive, MORE_SECTIONS } from "@/components/nav-links";
import { CLOSE_MORE_MENU_EVENT, closeMoreMenu, TOGGLE_MORE_MENU_EVENT } from "@/lib/more-menu-bus";

/**
 * More menu panel (Pass 4 / C4 / B1). Destinations only — no account, no knobs.
 * One panel, two presentations: sheet above the dock on phone, popover under
 * the header tab group on desk.
 *
 * Opened via the bus so AppHeader and BottomTabBar stay dumb triggers. A1
 * active-mark logic lives on the tabs themselves (aliases), not here.
 */
export function MoreMenu() {
	const [open, setOpen] = useState(false);
	const [mounted, setMounted] = useState(false);
	const pathname = usePathname();
	const panelRef = useRef<HTMLDivElement>(null);
	const titleId = useId();

	useEffect(() => setMounted(true), []);

	useEffect(() => {
		function onToggle() {
			setOpen((v) => !v);
		}
		function onClose() {
			setOpen(false);
		}
		window.addEventListener(TOGGLE_MORE_MENU_EVENT, onToggle);
		window.addEventListener(CLOSE_MORE_MENU_EVENT, onClose);
		return () => {
			window.removeEventListener(TOGGLE_MORE_MENU_EVENT, onToggle);
			window.removeEventListener(CLOSE_MORE_MENU_EVENT, onClose);
		};
	}, []);

	// Close when the route changes (menu item navigation or any other hop).
	useEffect(() => {
		if (pathname) setOpen(false);
	}, [pathname]);

	useEffect(() => {
		if (!open) return;
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") {
				event.preventDefault();
				closeMoreMenu();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const frame = requestAnimationFrame(() => {
			panelRef.current?.querySelector<HTMLElement>("a")?.focus();
		});
		return () => cancelAnimationFrame(frame);
	}, [open]);

	const onBackdrop = useCallback(() => {
		closeMoreMenu();
	}, []);

	if (!mounted || !open) return null;

	return createPortal(
		<div className="fixed inset-0 z-40" role="presentation">
			<button
				type="button"
				aria-label="Close menu"
				className="absolute inset-0 bg-ink/25 dark:bg-black/45"
				onClick={onBackdrop}
			/>

			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				className={[
					"absolute z-10 overflow-y-auto border border-line bg-surface elevation-overlay",
					// Phone: sheet above the dock
					"inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] max-h-[min(420px,58dvh)] rounded-[18px] p-3",
					// Desk: popover under the centered tab group (B1)
					"lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-[4.75rem] lg:w-[280px] lg:-translate-x-1/2 lg:rounded-[14px] lg:p-3",
				].join(" ")}
			>
				<div
					aria-hidden="true"
					className="mx-auto mb-2 h-1 w-9 rounded-pill bg-line-strong lg:hidden"
				/>
				<nav aria-labelledby={titleId}>
					<p id={titleId} className="sr-only">
						More
					</p>
					{MORE_SECTIONS.map((section) => (
						<div key={section.title} className="mt-3 first:mt-0">
							<p className="px-2 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-ink-4">
								{section.title}
							</p>
							<ul className="mt-1">
								{section.items.map((item) => {
									const active = isActive(item, pathname);
									return (
										<li key={item.key}>
											<Link
												href={item.href}
												aria-current={active ? "page" : undefined}
												onClick={() => closeMoreMenu()}
												className={`flex items-center justify-between rounded-control px-2 py-2.5 text-[15px] transition-colors hover:bg-surface-2 ${
													active ? "bg-surface-2 font-medium text-ink" : "font-normal text-ink"
												}`}
											>
												{item.label}
												<span aria-hidden="true" className="font-mono text-meta text-ink-4">
													→
												</span>
											</Link>
										</li>
									);
								})}
							</ul>
						</div>
					))}
				</nav>
			</div>
		</div>,
		document.body,
	);
}
