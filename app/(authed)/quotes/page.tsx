import { Suspense } from "react";
import { CreateTrigger } from "@/components/create-dialog";
import {
	ListRow,
	MoreBackLink,
	PageSkeleton,
	PillBone,
	ragged,
	repeat,
	TextBone,
} from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedQuotes } from "@/lib/cache/quotes";
import { readClock } from "@/lib/cache/settings";
import { viewKey } from "@/lib/store/keys";
import { Seed } from "@/lib/store/seed";
import { seedOf } from "@/lib/store/server";
import { QuoteList } from "./quote-list";

async function QuotesBody() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [read, clock] = await Promise.all([getCachedQuotes(), readClock()]);
	const { quotes } = read.data;
	// The header and the list read the entity store (#30).
	const snapshot = seedOf(read, clock, {
		views: [{ key: viewKey.quotes(), type: "quoteList", data: { rows: quotes } }],
	});

	return (
		<Seed snapshot={snapshot}>
			<QuoteList />
		</Seed>
	);
}

// QuoteList's silhouette: the italic quote (sometimes two lines), the author
// beneath, then the ANNOTATIONS and DELETE pills.
function QuotesFallback() {
	return (
		<PageSkeleton
			title="Quotes"
			measure={["w-16"]}
			action={<CreateTrigger label="New quote" disabled />}
		>
			<ul aria-hidden="true">
				{repeat(5, (i) => (
					<ListRow key={i} align="start">
						<div className="max-w-prose text-base leading-[1.45]">
							<TextBone width={i % 2 === 0 ? "w-full" : ragged(i)} />
							{i % 2 === 0 && <TextBone width={ragged(i + 1)} />}
						</div>
						<TextBone className="mt-1 font-mono text-meta" width="w-28" />
						<div className="mt-2 flex gap-2">
							<PillBone width="w-[114px]" />
							<PillBone width="w-[72px]" />
						</div>
					</ListRow>
				))}
			</ul>
		</PageSkeleton>
	);
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
