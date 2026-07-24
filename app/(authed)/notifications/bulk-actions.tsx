"use client";

import { useState, useTransition } from "react";
import { markAllNotificationsAction } from "@/app/(authed)/notifications/actions";
import { runAction } from "@/lib/client/toast";

const BUTTON =
	"rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink disabled:opacity-50";

/**
 * Ledger-wide read-state controls, so clearing a backlog isn't one click per
 * row. "Dismiss all" empties the visible list, so it asks once first.
 */
export function BulkActions({ unread, visible }: { unread: number; visible: number }) {
	const [pending, startTransition] = useTransition();
	const [confirmingDismiss, setConfirmingDismiss] = useState(false);

	const run = (status: "read" | "dismissed") =>
		startTransition(async () => {
			await runAction(() => markAllNotificationsAction(status), "Couldn't update notifications.");
			setConfirmingDismiss(false);
		});

	if (visible === 0) return null;

	return (
		<div className="mt-3 flex flex-wrap items-center gap-3">
			{unread > 0 && (
				<button type="button" disabled={pending} onClick={() => run("read")} className={BUTTON}>
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
						disabled={pending}
						onClick={() => run("dismissed")}
						className={`${BUTTON} border-line-strong text-ink`}
					>
						Confirm
					</button>
					<button
						type="button"
						disabled={pending}
						onClick={() => setConfirmingDismiss(false)}
						className={BUTTON}
					>
						Cancel
					</button>
				</span>
			) : (
				<button
					type="button"
					disabled={pending}
					onClick={() => setConfirmingDismiss(true)}
					className={BUTTON}
				>
					Dismiss all
				</button>
			)}
		</div>
	);
}
