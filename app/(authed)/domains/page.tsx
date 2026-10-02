import { Suspense } from "react";
import { CreateTrigger } from "@/components/create-dialog";
import {
	DotBone,
	ListRow,
	MoreBackLink,
	PageSkeleton,
	PillBone,
	ragged,
	repeat,
	SectionBone,
	StatBandBone,
	TextBone,
} from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedDomainBoard } from "@/lib/cache/domains";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { todayInTz } from "@/lib/dates";
import { toDomainItem } from "@/lib/services/observations";
import { viewKey } from "@/lib/store/keys";
import { Seed } from "@/lib/store/seed";
import type { Snapshot } from "@/lib/store/types";
import { DomainList } from "./domain-list";

async function DomainsBody() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const tz = await getCachedAppTimezone();
	const todayIso = todayInTz(tz);
	const { readAt, domains, touches } = await getCachedDomainBoard(todayIso, tz);
	// The header, the band and both sections read the entity store (#30). A
	// row carries its cadence rule and last touch, so the band is computed
	// from the same rows the list shows.
	const snapshot: Snapshot = {
		readAt,
		todayIso,
		tz,
		views: [
			{
				key: viewKey.domains(),
				type: "domainList",
				data: { rows: domains.map((d) => toDomainItem(d, touches)) },
			},
		],
	};

	return (
		<Seed snapshot={snapshot}>
			<DomainList />
		</Seed>
	);
}

// DomainList's silhouette: the cadence band, then the Active group — dot,
// name, the touch line, a description, the flag line and the three pills.
function DomainsFallback() {
	return (
		<PageSkeleton
			title="Domains"
			measure={["w-16", "w-20"]}
			action={<CreateTrigger label="New domain" disabled />}
		>
			<StatBandBone count={3} />
			<div>
				<SectionBone titleWidth="w-14">
					{repeat(4, (i) => (
						<ListRow
							key={i}
							align="start"
							leading={
								<span className="flex h-[1lh] items-center text-base leading-[1.35]">
									<DotBone />
								</span>
							}
						>
							<TextBone className="text-base leading-[1.35]" width={ragged(i + 4)} />
							<TextBone className="mt-0.5 font-mono text-meta" width="w-48" />
							{i % 2 === 0 && <TextBone className="mt-0.5 text-sm" width={ragged(i + 2)} />}
							<TextBone className="mt-0.5 font-mono text-meta" width="w-56" />
							<div className="mt-2 flex flex-wrap gap-2">
								<PillBone width="w-14" />
								<PillBone width="w-[120px]" />
								<PillBone width="w-20" />
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
export default function DomainsPage() {
	return (
		<div>
			<MoreBackLink />
			<Suspense fallback={<DomainsFallback />}>
				<DomainsBody />
			</Suspense>
		</div>
	);
}
