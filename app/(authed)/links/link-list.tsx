"use client";

import { EmptyState, ListSection, PageHeader } from "@/components/ui";
import type { LinkRow } from "@/lib/schemas/link";
import { useClock, useView, viewKey } from "@/lib/store";
import { LinkRowItem } from "./link-row";

const NO_LINKS: LinkRow[] = [];

/**
 * /links from the entity store (#30). The measure and both sections read the
 * same rows, so marking a link read moves it from Unread to Read at once, with
 * no page render.
 */
export function LinkList() {
	const links = useView(viewKey.links()) ?? NO_LINKS;
	const { tz } = useClock();
	const unread = links.filter((l) => l.status === "unread");
	const read = links.filter((l) => l.status === "read");

	return (
		<div>
			{/* The subtitle used to spell the unread count out in a sentence. The
			    measure carries it now, so the sentence goes. No create action —
			    links arrive through capture / webhook, not a header form. */}
			<PageHeader
				title="Links"
				// Unread takes no accent: a reading pile is a pile by design, not
				// something late. The orange means "this needs you" and spending it
				// here would make it mean "there is some".
				measure={[
					{ count: unread.length, label: "unread" },
					{ count: read.length, label: "read" },
				]}
			/>

			{unread.length === 0 && read.length === 0 ? (
				<EmptyState>Nothing shared yet. Send a link and it lands here.</EmptyState>
			) : (
				<div>
					{unread.length > 0 && (
						<ListSection title="Unread" count={unread.length}>
							<ul>
								{unread.map((link) => (
									<LinkRowItem key={link.id} link={link} tz={tz} />
								))}
							</ul>
						</ListSection>
					)}
					{read.length > 0 && (
						<ListSection title="Read" count={read.length}>
							<ul>
								{read.map((link) => (
									<LinkRowItem key={link.id} link={link} tz={tz} />
								))}
							</ul>
						</ListSection>
					)}
				</div>
			)}
		</div>
	);
}
