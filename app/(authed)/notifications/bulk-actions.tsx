"use client";

import { useState } from "react";

const BUTTON =
	"rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink disabled:opacity-50 active:opacity-70";

/**
 * Ledger-wide read-state controls, so clearing a backlog isn't one click per
 * row. "Dismiss all" empties the visible list, so it asks once first.
 * Parent owns the actual transitions (and optimistic state).
 */
export function BulkActions({
	unread,
	visible,
	onMarkAllRead,
	onDismissAll,
}: {
	unread: number;
	visible: number;
	onMarkAllRead: () => void;
	onDismissAll: () => void;
}) {
	const [confirmingDismiss, setConfirmingDismiss] = useState(false);

	if (visible === 0) return null;

	return (
		<div className="mt-3 flex flex-wrap items-center gap-3">
			{unread > 0 && (
				<button type="button" onClick={onMarkAllRead} className={BUTTON}>
					Mark all read
				</button>
			)}
			{confirmingDismiss ? (
				<span className="flex items-center gap-3">
					<span className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
						Dismiss all {visible}?
					</span>
					<button
						type="button"
						onClick={() => {
							onDismissAll();
							setConfirmingDismiss(false);
						}}
						className={`${BUTTON} border-line-strong text-ink`}
					>
						Confirm
					</button>
					<button type="button" onClick={() => setConfirmingDismiss(false)} className={BUTTON}>
						Cancel
					</button>
				</span>
			) : (
				<button type="button" onClick={() => setConfirmingDismiss(true)} className={BUTTON}>
					Dismiss all
				</button>
			)}
		</div>
	);
}
