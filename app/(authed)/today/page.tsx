import { requireOwnerPage } from "@/lib/auth";
import { todayInTz } from "@/lib/dates";
import { getBriefing } from "@/lib/services/briefing";
import { getAppTimezone } from "@/lib/services/settings";
import { AlertsRow } from "./alerts-row";
import { AnchorLine } from "./anchor-line";
import { BriefSection } from "./brief-section";
import { CadenceStrip } from "./cadence-strip";
import { CaptureChips } from "./capture-chips";
import { DaySchedule } from "./day-schedule";
import { LatestQuote } from "./latest-quote";
import { Masthead } from "./masthead";
import { ProjectsCard } from "./projects-card";
import { ResurfacedQuote } from "./resurfaced-quote";
import { RoutinesCard } from "./routines-card";

export default async function TodayPage() {
	const { sb } = await requireOwnerPage();
	const tz = await getAppTimezone(sb);
	const todayIso = todayInTz(tz);
	const briefing = await getBriefing(sb, tz, todayIso);

	const showLatestQuote =
		briefing.latestQuote !== null && briefing.latestQuote.id !== briefing.resurfaced?.id;

	// Action-first on mobile (ADR-0014): the schedule sits above the fold and
	// the editorial half comes after. On lg the two column wrappers swap so the
	// wide column keeps "In brief" and the quotes, as it has since ADR-0010.
	return (
		<div>
			<Masthead
				todayIso={todayIso}
				tz={tz}
				unreadNotifications={briefing.masthead.unreadNotifications}
			/>
			<AnchorLine anchor={briefing.anchor} tz={tz} />
			<CadenceStrip lines={briefing.cadence} />
			<AlertsRow
				triage={briefing.inboxCount}
				needsReview={briefing.needsReviewCount}
				ingestUnread={briefing.ingestUnreadCount}
			/>
			<DaySchedule
				schedule={briefing.daySchedule}
				todayIso={todayIso}
				openCount={briefing.anchor.openCount}
				overdueCount={briefing.anchor.overdueCount}
			/>

			<div className="mt-9 lg:grid lg:grid-cols-[1.5fr_1fr] lg:items-start lg:gap-x-10">
				<div className="lg:order-2">
					<RoutinesCard
						buckets={briefing.routineBuckets}
						done={briefing.routines.done}
						total={briefing.routines.total}
					/>
					<ProjectsCard projects={briefing.projects} />
				</div>

				<div className="mt-9 lg:order-1 lg:mt-0">
					<BriefSection lines={briefing.briefLines} />
					<ResurfacedQuote
						quote={briefing.resurfaced}
						skips={briefing.resurfacedSkips}
						hasQuotes={briefing.latestQuote !== null}
					/>
					{showLatestQuote && briefing.latestQuote && <LatestQuote quote={briefing.latestQuote} />}
				</div>
			</div>

			<CaptureChips />
		</div>
	);
}
