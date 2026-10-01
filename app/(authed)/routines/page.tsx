import { Suspense } from "react";
import { CreateTrigger } from "@/components/create-dialog";
import { MoreBackLink, PageSkeleton } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedRoutines } from "@/lib/cache/routines";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { shiftDay, todayInTz } from "@/lib/dates";
import { ROUTINE_HISTORY_DAYS, withHistory } from "@/lib/routine-stats";
import { viewKey } from "@/lib/store/keys";
import { Seed } from "@/lib/store/seed";
import type { Snapshot } from "@/lib/store/types";
import { RoutineList } from "./routine-list";

async function RoutinesBody() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	// The window start is the cache key, so the day is settled before the read.
	const tz = await getCachedAppTimezone();
	const todayIso = todayInTz(tz);
	const { readAt, routines, completionsByRoutine } = await getCachedRoutines(
		shiftDay(todayIso, -ROUTINE_HISTORY_DAYS),
	);
	// The same view Today's routines card reads (#29), so a tick on either
	// page moves both.
	const snapshot: Snapshot = {
		readAt,
		todayIso,
		tz,
		views: [
			{
				key: viewKey.routines(),
				type: "routineList",
				data: withHistory(routines, Object.values(completionsByRoutine).flat()),
			},
		],
	};

	return (
		<Seed snapshot={snapshot}>
			<RoutineList />
		</Seed>
	);
}

function RoutinesFallback() {
	return <PageSkeleton title="Routines" action={<CreateTrigger label="New routine" disabled />} />;
}

// The header carries data (its measure), so the whole body streams in behind
// the page's own boundary and the old loading.tsx is its fallback (#21). The
// header, the band and the rows read the entity store (#29).
export default function RoutinesPage() {
	return (
		<div>
			<MoreBackLink />
			<Suspense fallback={<RoutinesFallback />}>
				<RoutinesBody />
			</Suspense>
		</div>
	);
}
