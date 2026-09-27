import { Suspense } from "react";
import { EmptyState, ListSection, PageHeader, PageSkeleton } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedLinks } from "@/lib/cache/links";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { LinkRowItem } from "./link-row";

// The link reading list (ADR-0014, renamed from /ingest in ADR-0022).
async function LinksBody() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [links, tz] = await Promise.all([getCachedLinks(), getCachedAppTimezone()]);

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

function LinksFallback() {
	return <PageSkeleton title="Links" />;
}

// The header carries data (its measure), so the whole body streams in behind
// the page's own boundary and the old loading.tsx is its fallback (#21). The
// async child is where the entity store gets seeded (#26-#30).
export default function LinksPage() {
	return (
		<Suspense fallback={<LinksFallback />}>
			<LinksBody />
		</Suspense>
	);
}
