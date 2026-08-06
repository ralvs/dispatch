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
			<header className="hairline-strong pb-4">
				<p className="label">Links</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">The reading pile</h1>
				<p className="mt-1 text-meta text-ink-3">
					{unread.length === 0
						? "Links shared from the field. Nothing waiting."
						: `Links shared from the field. ${unread.length} unread.`}
				</p>
			</header>

			{unread.length === 0 && read.length === 0 ? (
				<p className="py-10 text-center font-serif italic text-ink-3">
					Nothing shared yet. Send a link and it lands here.
				</p>
			) : (
				<>
					{unread.length > 0 && (
						<section className="mt-6" aria-label="Unread links">
							<h2 className="label text-ink-4">Unread</h2>
							<ul className="list-card mt-3">
								{unread.map((link) => (
									<LinkRowItem key={link.id} link={link} tz={tz} />
								))}
							</ul>
						</section>
					)}

					{read.length > 0 && (
						<section className="mt-8" aria-label="Read links">
							<h2 className="label text-ink-4">Read</h2>
							<ul className="list-card mt-3">
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
