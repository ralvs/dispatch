import { Suspense } from "react";
import { CreateTrigger } from "@/components/create-dialog";
import { Bone, ListRow, MoreBackLink, PageSkeleton, repeat, TitleMetaBone } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedPeople } from "@/lib/cache/people";
import { readClock } from "@/lib/cache/settings";
import { viewKey } from "@/lib/store/keys";
import { Seed } from "@/lib/store/seed";
import { seedOf } from "@/lib/store/server";
import { PersonList } from "./person-list";

async function PeopleBody() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [read, clock] = await Promise.all([getCachedPeople(), readClock()]);
	const { people } = read.data;
	// The header and the list read the entity store (#30).
	const snapshot = seedOf(read, clock, {
		views: [{ key: viewKey.people(), type: "personList", data: { rows: people } }],
	});

	return (
		<Seed snapshot={snapshot}>
			<PersonList />
		</Seed>
	);
}

// PersonList's silhouette: one ungrouped list — the held dot slot, name
// over company, the relationship badge on the right.
function PeopleFallback() {
	return (
		<PageSkeleton
			title="People"
			measure={["w-16"]}
			action={<CreateTrigger label="New person" disabled />}
		>
			<ul aria-hidden="true">
				{repeat(7, (i) => (
					<ListRow
						key={i}
						leading={<span className="size-[9px] shrink-0" />}
						trailing={<Bone className="h-3.5 w-12 rounded-pill" />}
					>
						<TitleMetaBone i={i} meta={i % 3 !== 2} />
					</ListRow>
				))}
			</ul>
		</PageSkeleton>
	);
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
