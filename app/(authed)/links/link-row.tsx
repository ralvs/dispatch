"use client";

import { useTransition } from "react";
import { setLinkStatusAction } from "@/app/(authed)/links/actions";
import { ListRow, ROW_TITLE_CLASS } from "@/components/ui";
import { runAction } from "@/lib/client/toast";
import { formatInstant } from "@/lib/dates";
import type { LinkRow } from "@/lib/services/links";

/** The link's own words when it has them, otherwise the host it points at. */
function displayTitle(link: LinkRow): string {
	if (link.title) return link.title;
	try {
		return new URL(link.url).hostname.replace(/^www\./, "");
	} catch {
		return link.url;
	}
}

export function LinkRowItem({ link, tz }: { link: LinkRow; tz: string }) {
	const [pending, startTransition] = useTransition();
	const unread = link.status === "unread";
	const mark = (status: "unread" | "read" | "dismissed") =>
		startTransition(async () => {
			await runAction(async () => setLinkStatusAction(link.id, status), "Couldn't update link.");
		});

	return (
		<ListRow
			align="start"
			className={pending ? "opacity-50" : ""}
			trailing={
				<p className="shrink-0 font-mono text-meta text-ink-4">
					{formatInstant(link.created_at, tz)}
				</p>
			}
		>
			<a
				href={link.url}
				target="_blank"
				rel="noreferrer noopener"
				className={`block min-w-0 hover:text-accent-ink ${unread ? "text-ink" : "text-ink-2"}`}
			>
				<span className={`${ROW_TITLE_CLASS} ${unread ? "" : "text-ink-2"}`}>
					{displayTitle(link)}
					<span aria-hidden className="ml-1.5 font-mono text-meta text-ink-4">
						↗
					</span>
				</span>
			</a>

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
					className="rounded-control border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink active:opacity-70"
				>
					{unread ? "Mark read" : "Mark unread"}
				</button>
				{link.status !== "dismissed" && (
					<button
						type="button"
						disabled={pending}
						onClick={() => mark("dismissed")}
						className="rounded-control border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink active:opacity-70"
					>
						Dismiss
					</button>
				)}
			</div>
		</ListRow>
	);
}
