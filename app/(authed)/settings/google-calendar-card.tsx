"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { disconnectGoogleCalendar } from "./actions";

type Props = {
	oauthConfigured: boolean;
	connected: boolean;
	accountEmail: string | null;
	lastSyncedAt: string | null;
	statusQuery: string | null;
	statusReason: string | null;
};

export function GoogleCalendarCard({
	oauthConfigured,
	connected,
	accountEmail,
	lastSyncedAt,
	statusQuery,
	statusReason,
}: Props) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();

	return (
		<div className="mt-2 border-b border-line pb-4">
			<p className="font-serif text-ink">Google Calendar</p>
			<p className="mt-1 font-mono text-meta text-ink-4">
				Pull-only work events (calendar.readonly). Sign in as your Engine account.
			</p>

			{statusQuery === "connected" && (
				<p className="mt-2 font-mono text-meta text-accent-slip" role="status">
					Connected.
				</p>
			)}
			{statusQuery === "error" && (
				<p className="mt-2 font-mono text-meta text-accent-slip" role="alert">
					Connect failed{statusReason ? `: ${statusReason}` : "."}
				</p>
			)}
			{statusQuery === "disconnected" && (
				<p className="mt-2 font-mono text-meta text-ink-3" role="status">
					Disconnected.
				</p>
			)}

			{!oauthConfigured ? (
				<p className="mt-3 font-mono text-meta text-ink-3">
					Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Connect.
				</p>
			) : connected ? (
				<div className="mt-3 flex flex-wrap items-center gap-3">
					<p className="font-mono text-meta text-ink-3">
						{accountEmail ? `Connected as ${accountEmail}` : "Connected"}
						{lastSyncedAt ? ` · last sync ${lastSyncedAt}` : ""}
					</p>
					<button
						type="button"
						disabled={pending}
						className="font-mono text-meta text-ink-3 underline decoration-line underline-offset-2 hover:text-ink disabled:opacity-50"
						onClick={() => {
							startTransition(async () => {
								await disconnectGoogleCalendar();
								router.refresh();
							});
						}}
					>
						{pending ? "Disconnecting…" : "Disconnect"}
					</button>
				</div>
			) : (
				<a
					href="/api/google/oauth/start"
					className="mt-3 inline-block font-mono text-meta text-ink underline decoration-line underline-offset-2 hover:text-accent-slip"
				>
					Connect Google Calendar
				</a>
			)}
		</div>
	);
}
