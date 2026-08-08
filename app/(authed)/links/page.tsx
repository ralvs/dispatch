import { EmptyState, PageHeader, SectionHead } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedLinks } from "@/lib/cache/links";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { LinkRowItem } from "./link-row";

// The link reading list (ADR-0014, renamed from /ingest in ADR-0022).
export default async function LinksPage() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [links, tz] = await Promise.all([getCachedLinks(), getCachedAppTimezone()]);

	const unread = links.filter((l) => l.status === "unread");
	const read = links.filter((l) => l.status === "read");

	return (
		<div>
			{/* The subtitle used to spell the unread count out in a sentence. The
			    measure carries it now, so the sentence goes. */}
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
				<>
					{unread.length > 0 && (
						<section aria-label="Unread links">
							<SectionHead title="Unread" aside={String(unread.length)} />
							<ul>
								{unread.map((link) => (
									<LinkRowItem key={link.id} link={link} tz={tz} />
								))}
							</ul>
						</section>
					)}

					{read.length > 0 && (
						<section className="mt-8" aria-label="Read links">
							<SectionHead title="Read" aside={String(read.length)} />
							<ul>
								{read.map((link) => (
									<LinkRowItem key={link.id} link={link} tz={tz} />
								))}
							</ul>
						</section>
					)}
				</>
			)}
		</div>
	);
}
