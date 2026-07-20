"use client";

import { useTransition } from "react";
import { setLinkStatusAction } from "@/app/(authed)/ingest/actions";
import { formatInstant } from "@/lib/dates";
import type { IngestLinkRow } from "@/lib/services/ingest-links";

/** The link's own words when it has them, otherwise the host it points at. */
function displayTitle(link: IngestLinkRow): string {
	if (link.title) return link.title;
	try {
		return new URL(link.url).hostname.replace(/^www\./, "");
	} catch {
		return link.url;
	}
}

export function LinkRowItem({ link, tz }: { link: IngestLinkRow; tz: string }) {
	const [pending, startTransition] = useTransition();
	const unread = link.status === "unread";
	const mark = (status: "unread" | "read" | "dismissed") =>
		startTransition(() => setLinkStatusAction(link.id, status));

	return (
		<li className={`hairline py-3 ${pending ? "opacity-50" : ""}`}>
			<div className="flex items-baseline justify-between gap-4">
				<a
					href={link.url}
					target="_blank"
					rel="noreferrer noopener"
					className={`min-w-0 flex-1 text-sm hover:text-accent ${unread ? "text-ink" : "text-ink-2"}`}
				>
					{displayTitle(link)}
					<span aria-hidden className="ml-1.5 font-mono text-meta text-ink-4">
						↗
					</span>
				</a>
				<p className="shrink-0 font-mono text-meta text-ink-4">
					{formatInstant(link.created_at, tz)}
				</p>
			</div>

			{link.description && <p className="mt-1 text-meta text-ink-3">{link.description}</p>}

			<p className="mt-1 truncate font-mono text-meta text-ink-4">
				{link.url}
				{link.source ? ` · ${link.source}` : ""}
			</p>

			<div className="mt-2 flex items-baseline gap-3">
				<button
					type="button"
					disabled={pending}
					onClick={() => mark(unread ? "read" : "unread")}
					className="rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
				>
					{unread ? "Mark read" : "Mark unread"}
				</button>
				{link.status !== "dismissed" && (
					<button
						type="button"
						disabled={pending}
						onClick={() => mark("dismissed")}
						className="rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
					>
						Dismiss
					</button>
				)}
			</div>
		</li>
	);
}
