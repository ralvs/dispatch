import { Suspense } from "react";
import { CreateTrigger } from "@/components/create-dialog";
import { MoreBackLink, PageSkeleton } from "@/components/ui";
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

function DomainsFallback() {
	return <PageSkeleton title="Domains" action={<CreateTrigger label="New domain" disabled />} />;
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
