import { Suspense } from "react";
import { CreateTrigger } from "@/components/create-dialog";
import { MoreBackLink, PageSkeleton } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedPeople } from "@/lib/cache/people";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { todayInTz } from "@/lib/dates";
import { viewKey } from "@/lib/store/keys";
import { Seed } from "@/lib/store/seed";
import type { Snapshot } from "@/lib/store/types";
import { PersonList } from "./person-list";

async function PeopleBody() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [{ readAt, people }, tz] = await Promise.all([getCachedPeople(), getCachedAppTimezone()]);
	// The header and the list read the entity store (#30).
	const snapshot: Snapshot = {
		readAt,
		todayIso: todayInTz(tz),
		tz,
		views: [{ key: viewKey.people(), type: "personList", data: { rows: people } }],
	};

	return (
		<Seed snapshot={snapshot}>
			<PersonList />
		</Seed>
	);
}

function PeopleFallback() {
	return <PageSkeleton title="People" action={<CreateTrigger label="New person" disabled />} />;
}

// The header carries data (its measure), so the whole body streams in behind
// the page's own boundary and the old loading.tsx is its fallback (#21). The
// async child seeds the entity store (#30).
export default function PeoplePage() {
	return (
		<div>
			<MoreBackLink />
			<Suspense fallback={<PeopleFallback />}>
				<PeopleBody />
			</Suspense>
		</div>
	);
}
