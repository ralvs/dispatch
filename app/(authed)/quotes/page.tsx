import { Suspense } from "react";
import { CreateTrigger } from "@/components/create-dialog";
import { MoreBackLink, PageSkeleton } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedQuotes } from "@/lib/cache/quotes";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { todayInTz } from "@/lib/dates";
import { viewKey } from "@/lib/store/keys";
import { Seed } from "@/lib/store/seed";
import type { Snapshot } from "@/lib/store/types";
import { QuoteList } from "./quote-list";

async function QuotesBody() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [{ readAt, quotes }, tz] = await Promise.all([getCachedQuotes(), getCachedAppTimezone()]);
	// The header and the list read the entity store (#30).
	const snapshot: Snapshot = {
		readAt,
		todayIso: todayInTz(tz),
		tz,
		views: [{ key: viewKey.quotes(), type: "quoteList", data: { rows: quotes } }],
	};

	return (
		<Seed snapshot={snapshot}>
			<QuoteList />
		</Seed>
	);
}

function QuotesFallback() {
	return <PageSkeleton title="Quotes" action={<CreateTrigger label="New quote" disabled />} />;
}

// The header carries data (its measure), so the whole body streams in behind
// the page's own boundary and the old loading.tsx is its fallback (#21). The
// async child seeds the entity store (#30).
export default function QuotesPage() {
	return (
		<div>
			<MoreBackLink />
			<Suspense fallback={<QuotesFallback />}>
				<QuotesBody />
			</Suspense>
		</div>
	);
}
