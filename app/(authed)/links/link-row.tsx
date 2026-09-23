"use client";

import { useState, useTransition } from "react";
import { setLinkStatusAction } from "@/app/(authed)/links/actions";
import { ListRow, rowTitle } from "@/components/ui";
import { runAction } from "@/lib/client/toast";
import { formatInstant } from "@/lib/dates";
import type { LinkRow } from "@/lib/services/links";

/** "x.com", not the whole href — the raw URL is noise once the row has words. */
function hostOf(url: string): string {
	return URL.parse(url)?.hostname.replace(/^www\./, "") ?? url;
}

/** The link's own words when it has them, otherwise the host it points at. */
function displayTitle(link: LinkRow): string {
	return link.title ?? hostOf(link.url);
}

const actionClass =
	"rounded-control border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink active:opacity-70";

/**
 * The publisher's own preview, hotlinked (docs/adr/0064). No referrer, so a
 * host that blocks hotlinking by Referer still serves it; and a dead URL hides
 * itself rather than leaving a broken-image box in the list.
 */
function Thumbnail({ src }: { src: string }) {
	const [failed, setFailed] = useState(false);
	if (failed) return null;
	return (
		// biome-ignore lint/performance/noImgElement: a hotlinked third-party image, deliberately not proxied through the optimizer
		<img
			src={src}
			alt=""
			loading="lazy"
			decoding="async"
			referrerPolicy="no-referrer"
			onError={() => setFailed(true)}
			className="aspect-[4/3] w-20 rounded-control border border-line object-cover sm:w-28"
		/>
	);
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
				<div className="flex shrink-0 flex-col items-end gap-2">
					<p className="font-mono text-meta text-ink-4">{formatInstant(link.created_at, tz)}</p>
					{link.image_url?.startsWith("https://") && <Thumbnail src={link.image_url} />}
				</div>
			}
		>
			<a
				href={link.url}
				target="_blank"
				rel="noreferrer noopener"
				className={`block min-w-0 hover:text-accent-ink ${unread ? "text-ink" : "text-ink-2"}`}
			>
				<span
					className={rowTitle({
						tone: unread ? "default" : "muted",
						layout: "bare",
						className: "line-clamp-2",
					})}
				>
					{displayTitle(link)}
					<span aria-hidden className="ml-1.5 font-mono text-meta text-ink-4">
						↗
					</span>
				</span>
			</a>

			{/* Line breaks stay: a post's list or hook line is part of what it says. */}
			{link.description && (
				<p className="mt-1 line-clamp-3 max-w-(--measure-prose) whitespace-pre-line text-sm leading-relaxed text-ink-3">
					{link.description}
				</p>
			)}

			<p className="mt-1 truncate font-mono text-meta text-ink-4">{hostOf(link.url)}</p>

			<div className="mt-2 flex items-baseline gap-3">
				<button
					type="button"
					disabled={pending}
					onClick={() => mark(unread ? "read" : "unread")}
					className={actionClass}
				>
					{unread ? "Mark read" : "Mark unread"}
				</button>
				{link.status !== "dismissed" && (
					<button
						type="button"
						disabled={pending}
						onClick={() => mark("dismissed")}
						className={actionClass}
					>
						Dismiss
					</button>
				)}
			</div>
		</ListRow>
	);
}
