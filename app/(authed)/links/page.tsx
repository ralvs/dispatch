import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedLinks } from "@/lib/cache/links";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { todayInTz } from "@/lib/dates";
import { viewKey } from "@/lib/store/keys";
import { Seed } from "@/lib/store/seed";
import type { Snapshot } from "@/lib/store/types";
import { LinkList } from "./link-list";

// The link reading list (ADR-0014, renamed from /ingest in ADR-0022).
async function LinksBody() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [{ readAt, links }, tz] = await Promise.all([getCachedLinks(), getCachedAppTimezone()]);
	// The measure and both sections read the entity store (#30); the view
	// drops dismissed rows.
	const snapshot: Snapshot = {
		readAt,
		todayIso: todayInTz(tz),
		tz,
		views: [{ key: viewKey.links(), type: "linkList", data: { rows: links } }],
	};

	return (
		<Seed snapshot={snapshot}>
			<LinkList />
		</Seed>
	);
}

function LinksFallback() {
	return <PageSkeleton title="Links" />;
}

// The header carries data (its measure), so the whole body streams in behind
// the page's own boundary and the old loading.tsx is its fallback (#21). The
// async child seeds the entity store (#30).
export default function LinksPage() {
	return (
		<Suspense fallback={<LinksFallback />}>
			<LinksBody />
		</Suspense>
	);
}
