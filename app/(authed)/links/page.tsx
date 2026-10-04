import { Suspense } from "react";
import {
	ListRow,
	PageSkeleton,
	PillBone,
	ragged,
	repeat,
	SectionBone,
	TextBone,
} from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedLinks } from "@/lib/cache/links";
import { readClock } from "@/lib/cache/settings";
import { viewKey } from "@/lib/store/keys";
import { Seed } from "@/lib/store/seed";
import { seedOf } from "@/lib/store/server";
import { LinkList } from "./link-list";

// The link reading list (ADR-0014, renamed from /ingest in ADR-0022).
async function LinksBody() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [read, clock] = await Promise.all([getCachedLinks(), readClock()]);
	const { links } = read.data;
	// The measure and both sections read the entity store (#30); the view
	// drops dismissed rows.
	const snapshot = seedOf(read, clock, {
		views: [{ key: viewKey.links(), type: "linkList", data: { rows: links } }],
	});

	return (
		<Seed snapshot={snapshot}>
			<LinkList />
		</Seed>
	);
}

// LinkList's silhouette: the Unread group — title, a line of description,
// the host, the two action pills, and the date on the right.
function LinksFallback() {
	return (
		<PageSkeleton title="Links" measure={["w-16", "w-12"]}>
			<div>
				<SectionBone titleWidth="w-16">
					{repeat(5, (i) => (
						<ListRow
							key={i}
							align="start"
							trailing={<TextBone className="font-mono text-meta" width="w-20" />}
						>
							<TextBone className="text-base leading-[1.35]" width={ragged(i)} />
							{i % 2 === 0 && (
								<TextBone className="mt-1 text-sm leading-relaxed" width={ragged(i + 2)} />
							)}
							<TextBone className="mt-1 font-mono text-meta" width="w-24" />
							<div className="mt-2 flex gap-3">
								<PillBone width="w-[94px]" />
								<PillBone width="w-[76px]" />
							</div>
						</ListRow>
					))}
				</SectionBone>
			</div>
		</PageSkeleton>
	);
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
