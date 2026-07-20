import { requireOwnerPage } from "@/lib/auth";
import { todayInTz } from "@/lib/dates";
import { getBriefing } from "@/lib/services/briefing";
import { getAppTimezone } from "@/lib/services/settings";
import { AnchorLine } from "./anchor-line";
import { BriefSection } from "./brief-section";
import { CaptureChips } from "./capture-chips";
import { DoingCard } from "./doing-card";
import { EventsCard } from "./events-card";
import { LatestQuote } from "./latest-quote";
import { Masthead } from "./masthead";
import { ProjectsCard } from "./projects-card";
import { ResurfacedQuote } from "./resurfaced-quote";
import { RoutinesCard } from "./routines-card";
import { TriageStrip } from "./triage-strip";

export default async function TodayPage() {
	const { sb } = await requireOwnerPage();
	const tz = await getAppTimezone(sb);
	const todayIso = todayInTz(tz);
	const briefing = await getBriefing(sb, tz, todayIso);

	const showLatestQuote =
		briefing.latestQuote !== null && briefing.latestQuote.id !== briefing.resurfaced?.id;

	return (
		<div>
			<Masthead
				todayIso={todayIso}
				tz={tz}
				unreadNotifications={briefing.masthead.unreadNotifications}
			/>
			<AnchorLine anchor={briefing.anchor} tz={tz} />
			{briefing.inboxCount > 0 && <TriageStrip count={briefing.inboxCount} />}

			<div className="mt-7 lg:grid lg:grid-cols-[1.5fr_1fr] lg:items-start lg:gap-x-10">
				<div>
					<BriefSection lines={briefing.briefLines} />
					<ResurfacedQuote
						quote={briefing.resurfaced}
						skips={briefing.resurfacedSkips}
						hasQuotes={briefing.latestQuote !== null}
					/>
					{showLatestQuote && briefing.latestQuote && <LatestQuote quote={briefing.latestQuote} />}
				</div>

				<div className="mt-9 lg:mt-0">
					<EventsCard events={briefing.todayEvents} tz={tz} />
					<DoingCard
						tasks={briefing.doingToday}
						todayIso={todayIso}
						openCount={briefing.anchor.openCount}
						overdueCount={briefing.anchor.overdueCount}
					/>
					<RoutinesCard
						buckets={briefing.routineBuckets}
						done={briefing.routines.done}
						total={briefing.routines.total}
					/>
					<ProjectsCard projects={briefing.projects} />
				</div>
			</div>

			<CaptureChips />
		</div>
	);
}
