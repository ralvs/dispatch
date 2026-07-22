import { SoftRefresh } from "@/components/soft-refresh";
import { requireOwnerPage } from "@/lib/auth";
import { formatInstant, todayInTz } from "@/lib/dates";
import { getBriefing } from "@/lib/services/briefing";
import { getAppTimezone } from "@/lib/services/settings";
import { AlertsRow } from "./alerts-row";
import { AnchorLine } from "./anchor-line";
import { BriefSection } from "./brief-section";
import { DaySchedule } from "./day-schedule";
import { DayTape } from "./day-tape";
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
	const nowUtcIso = new Date().toISOString();
	const nowLabel = formatInstant(nowUtcIso, tz, "HH:mm");

	const showLatestQuote =
		briefing.latestQuote !== null && briefing.latestQuote.id !== briefing.resurfaced?.id;

	return (
		<div>
			{/* Keep the day tape "now", past events, and counts honest without a full reload. */}
			<SoftRefresh />
			<Masthead todayIso={todayIso} unreadNotifications={briefing.masthead.unreadNotifications} />

			{/* The day at a glance: the anchor sentence already carries the
			 * counts, so it stands alone rather than repeating them as a strip
			 * of big numbers — Awaiting decision fills the row beside it,
			 * vertically centered against whichever side runs taller. */}
			<div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1.6fr_1fr] lg:items-center lg:gap-14">
				<AnchorLine anchor={briefing.anchor} tz={tz} />
				<AlertsRow
					triage={briefing.inboxCount}
					needsReview={briefing.needsReviewCount}
					ingestUnread={briefing.ingestUnreadCount}
				/>
			</div>

			<DayTape timeline={briefing.daySchedule.timeline} todayIso={todayIso} nowLabel={nowLabel} />

			<DaySchedule schedule={briefing.daySchedule} todayIso={todayIso} nowUtcIso={nowUtcIso} />

			<div className="mt-14 grid grid-cols-1 gap-14 lg:grid-cols-[1.5fr_1fr] lg:items-start lg:gap-x-10">
				<div className="min-w-0">
					<BriefSection lines={briefing.briefLines} />
					<ResurfacedQuote
						quote={briefing.resurfaced}
						skips={briefing.resurfacedSkips}
						hasQuotes={briefing.latestQuote !== null}
					/>
					{showLatestQuote && briefing.latestQuote && <LatestQuote quote={briefing.latestQuote} />}
				</div>

				<div className="min-w-0">
					<RoutinesCard
						buckets={briefing.routineBuckets}
						done={briefing.routines.done}
						total={briefing.routines.total}
					/>
					<ProjectsCard projects={briefing.projects} />
				</div>
			</div>
		</div>
	);
}
