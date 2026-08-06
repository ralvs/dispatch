"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

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
				<Button type="button" variant="tertiary" size="sm" onClick={onMarkAllRead}>
					Mark all read
				</Button>
			)}
			{confirmingDismiss ? (
				<span className="flex items-center gap-3">
					<span className="label">Dismiss all {visible}?</span>
					<Button
						type="button"
						variant="secondary"
						size="sm"
						onClick={() => {
							onDismissAll();
							setConfirmingDismiss(false);
						}}
					>
						Confirm
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => setConfirmingDismiss(false)}
					>
						Cancel
					</Button>
				</span>
			) : (
				<Button
					type="button"
					variant="tertiary"
					size="sm"
					onClick={() => setConfirmingDismiss(true)}
				>
					Dismiss all
				</Button>
			)}
		</div>
	);
}
