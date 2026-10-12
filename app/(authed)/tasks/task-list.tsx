"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TaskDialog } from "@/components/task-dialog";
import type { TaskDomainOption, TaskProjectOption } from "@/components/task-fields";
import { EmptyState, PageHeader, SectionHead, StatBand } from "@/components/ui";
import { completeTaskAction, reopenTaskAction, setTop3Action } from "@/lib/actions/tasks";
import { dateOfInstant, recentDoneSinceDate } from "@/lib/dates";
import type { MentionCandidate } from "@/lib/mentions";
import { isQuiet } from "@/lib/quiet";
import type { TaskRow } from "@/lib/services/tasks";
import { useView, viewKey } from "@/lib/store";
import type { TaskLists } from "@/lib/store/kinds/task";
import { bindTaskHandlers, useTaskIntentRunner } from "@/lib/task-interaction/run-intent";
import { isDueToday, isOverdue, isTop3Today, TOP3_SLOTS } from "@/lib/task-predicates";
import { NewTaskButton } from "./new-task-button";
import { TaskScopeFilters, type TaskStatusFilter, TaskStatusStrip, UNFILED } from "./task-filters";
import { TaskRowItem } from "./task-row";
import { taskStats } from "./task-stats-band";

const NO_LISTS: TaskLists = { open: [], done: [] };

function isTaskStatusFilter(value: string | undefined): value is TaskStatusFilter {
	return value === "open" || value === "overdue" || value === "today" || value === "quiet";
}

/** Builds the shareable `?status=&project=&domain=` query string, dropping defaults. */
function filterQuery(status: TaskStatusFilter, projectId: string, domainId: string): string {
	const params = new URLSearchParams();
	if (status !== "open") params.set("status", status);
	if (projectId) params.set("project", projectId);
	if (domainId) params.set("domain", domainId);
	const qs = params.toString();
	return qs ? `?${qs}` : "";
}

/** Reads its rows from the entity store view the page's <Seed> fed (#26). */
export function TaskList({
	todayIso,
	domains,
	projects,
	initialStatus,
	initialProjectId,
	initialDomainId,
	taskNoteIds,
	tz,
	people = [],
	taskMentions,
	quietProjectIds = [],
}: {
	todayIso: string;
	domains: TaskDomainOption[];
	/**
	 * Carries `domain_id` because the task form needs it: choosing a project
	 * there settles the domain (components/task-fields.tsx), so the
	 * narrow's filter options are no longer a wide enough shape to pass on.
	 */
	projects?: TaskProjectOption[];
	/** From `?status=` — initial value only; every later change is client state. */
	initialStatus?: string;
	/** From `?project=` — same deep-link contract as initialStatus. */
	initialProjectId?: string;
	/** From `?domain=` — same deep-link contract as initialStatus. */
	initialDomainId?: string;
	/** task id -> linked note id, for the linked-note glyph on rows. */
	taskNoteIds?: Record<string, string>;
	/** App timezone — threaded to rows so "Recently done" can show a completion date and time. */
	tz: string;
	/** @mention candidates (docs/adr/0030) for the capture bar and edit-form autocomplete. */
	people?: MentionCandidate[];
	/** task id -> people already mentioned in it, for the mention chips on rows. */
	taskMentions?: Record<string, { id: string; name: string }[]>;
	/** The quiet projects (lib/quiet.ts) — what makes an undated task quiet. */
	quietProjectIds?: string[];
}) {
	const quietProjects = useMemo(() => new Set(quietProjectIds), [quietProjectIds]);
	const lists = useView(viewKey.tasks()) ?? NO_LISTS;
	const run = useTaskIntentRunner();
	// Unfiled open tasks — the header's link to /inbox. From the store, so
	// filing one elsewhere moves it here too.
	const inboxCount = lists.open.filter((t) => t.domain_id === null).length;

	// The header's `+`. One standing action, right-aligned on the title's
	// baseline, rather than the standing capture line it replaced (docs/adr/0043).
	const [creating, setCreating] = useState(false);

	// Ids of tasks created optimistically in this session — always shown
	// regardless of the active filter, so a capture typed while "Domain: Work"
	// is active doesn't vanish just because it optimistically has no domain
	// yet. Once the store confirms the write, the fake id is swapped for the
	// server's row and simply no longer matches, so nothing prunes this set.
	const [sessionCreatedIds] = useState(() => new Set<string>());

	const [status, setStatus] = useState<TaskStatusFilter>(
		isTaskStatusFilter(initialStatus) ? initialStatus : "open",
	);
	// Deep-link ids (?project=, ?domain=) are taken verbatim from the URL and
	// may point at a project/domain that no longer exists — a stale bookmark,
	// a deleted project. Validate against what actually loaded before seeding
	// state; an unmatched id would otherwise render the select as "All" while
	// silently rejecting every row.
	const [projectId, setProjectId] = useState(
		initialProjectId &&
			(initialProjectId === UNFILED || (projects ?? []).some((p) => p.id === initialProjectId))
			? initialProjectId
			: "",
	);
	const [domainId, setDomainId] = useState(
		initialDomainId &&
			(initialDomainId === UNFILED || domains.some((d) => d.id === initialDomainId))
			? initialDomainId
			: "",
	);

	// Client state is the source of truth from here on; the URL just mirrors
	// it so the current view stays shareable (history.replaceState, not a
	// navigation — filtering is instant and shouldn't add history entries).
	// Not while the address is a task's own (`/tasks/<id>`, docs/adr/0079): the
	// board is the page behind that dialog, and the address belongs to it.
	useEffect(() => {
		if (window.location.pathname !== "/tasks") return;
		const qs = filterQuery(status, projectId, domainId);
		window.history.replaceState(null, "", `/tasks${qs}`);
	}, [status, projectId, domainId]);

	function handlersFor(task: TaskRow) {
		return bindTaskHandlers(
			task,
			run,
			{
				complete: completeTaskAction,
				reopen: reopenTaskAction,
				setTop3: setTop3Action,
			},
			{ top3DateIso: todayIso, todayIso },
		);
	}

	// Project/Domain AND together and apply across whichever status is showing.
	// UNFILED narrows to rows where the column is null (docs/adr/0027); "" is
	// the no-narrow case and has to stay distinct from it.
	function matchesFilters(t: TaskRow): boolean {
		if (sessionCreatedIds.has(t.id)) return true;

		if (projectId === UNFILED) {
			if (t.project_id !== null) return false;
		} else if (projectId && t.project_id !== projectId) return false;

		if (domainId === UNFILED) {
			if (t.domain_id !== null) return false;
		} else if (domainId && t.domain_id !== domainId) return false;

		return true;
	}

	// Quiet tasks are parked, not open: undated work in a project that is not
	// active would otherwise sit in every view looking overdue-ish forever.
	// They are their own view and are excluded from all three of the others.
	const scoped = lists.open.filter(matchesFilters);
	const filteredOpen = scoped.filter((t) => !isQuiet(t, quietProjects));
	const quietTasks = scoped.filter((t) => isQuiet(t, quietProjects));
	const filteredDone = lists.done.filter(matchesFilters);
	const overdueTasks = filteredOpen.filter((t) => isOverdue(t, todayIso));
	const todayTasks = filteredOpen.filter((t) => isDueToday(t, todayIso));

	// Starring used to be near-invisible here: listTasks never orders by it, so a
	// pinned row stayed exactly where it was. Split the open list so the day's
	// shortlist has somewhere to live. Only meaningful on the Open view —
	// Overdue and Today show a single flat list.
	const top3 = status === "open" ? filteredOpen.filter((t) => isTop3Today(t, todayIso)) : [];
	const rest = status === "open" ? filteredOpen.filter((t) => !isTop3Today(t, todayIso)) : [];
	const slotsOpen = TOP3_SLOTS - top3.length;
	// The Open view's "Recently done" band is a glance-strip, and since the Done
	// filter is gone it is the only place completed work shows up. Last three
	// local calendar days — not a row cap — so yesterday is still visible and
	// last week is not.
	const sinceDate = recentDoneSinceDate(todayIso);
	const recentDoneBand = filteredDone.filter(
		(t) => t.completed_at !== null && dateOfInstant(t.completed_at, tz) >= sinceDate,
	);

	return (
		// The whole page lives in here, header included: the count strip is the
		// status filter now, so it has to read the same client state the list does.
		<div>
			{/* No measure, and that is the decision rather than an omission
			    (Pass 1 gate, .impeccable/mocks/tasks-lab.html option T2). The
			    status strip below is a count that is also the filter, so it sits
			    with the other controls instead of on the title's baseline: where
			    a page's reading is also its control, the reading goes with the
			    control. Putting it in the measure slot would have taught eleven
			    other pages that a count there is sometimes clickable. */}
			<PageHeader title="Tasks" action={<NewTaskButton onClick={() => setCreating(true)} />} />

			{/* Whole-board readings the status strip cannot give you
				(ADR-0053). Open / overdue / today / quiet live on the strip
				below; repeating them here was the same count twice. */}
			<StatBand stats={taskStats(lists.open, lists.done, todayIso, tz, quietProjects)} />

			{/* `quickAdd` is what makes this dialog the fast path too: a create
			    carrying nothing but a title goes through the parser, anything
			    else is taken literally (docs/adr/0043). */}
			<TaskDialog
				open={creating}
				onClose={() => setCreating(false)}
				mode="create"
				domains={domains}
				projects={projects ?? []}
				todayIso={todayIso}
				people={people}
				quickAdd
				onCreating={(id) => sessionCreatedIds.add(id)}
			/>

			{/* Status left, the two scope narrows right — one bar, because they
			    are one filter set and they narrow the same list. */}
			<div>
				<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
					<TaskStatusStrip
						status={status}
						onStatusChange={setStatus}
						openCount={filteredOpen.length}
						overdueCount={overdueTasks.length}
						todayCount={todayTasks.length}
						quietCount={quietTasks.length}
					/>
					<TaskScopeFilters
						projectId={projectId}
						onProjectChange={setProjectId}
						domainId={domainId}
						onDomainChange={setDomainId}
						projects={projects ?? []}
						domains={domains}
					/>
				</div>
				{inboxCount > 0 && (
					<Link href="/inbox" className="mt-2 inline-block text-meta text-accent-ink">
						{inboxCount} in the inbox →
					</Link>
				)}
			</div>

			{status === "open" && (
				<>
					{/* Top 3 is split here in the client, not on the server, so tapping ☆
					 * moves a row between the two groups on the same tick the star flips —
					 * both read from the one optimistic list. */}
					{top3.length > 0 && (
						<section className="mt-9" aria-label="Today's top 3">
							{/* The same head Today's Top3Section carries, down to the
							    aside: the two surfaces disagreeing about how many slots
							    are open would be the one thing worth reading twice. */}
							<SectionHead
								title="Top 3 today"
								aside={
									slotsOpen > 0 ? (
										<span className="font-mono text-meta text-ink-3">
											{slotsOpen} slot{slotsOpen === 1 ? "" : "s"} open
										</span>
									) : undefined
								}
							/>
							<ul>
								{top3.map((t) => (
									<TaskRowItem
										key={t.id}
										task={t}
										todayIso={todayIso}
										handlers={handlersFor(t)}
										noteId={taskNoteIds?.[t.id]}
										mentions={taskMentions?.[t.id]}
									/>
								))}
							</ul>
						</section>
					)}

					<section className="mt-9" aria-label="Open tasks">
						<SectionHead title="Open" />
						{filteredOpen.length === 0 ? (
							<EmptyState hint="Write one with the + at the top of the page, or capture a thought and let it file itself.">
								Nothing on the docket.
							</EmptyState>
						) : (
							// Everything open may already be starred, in which case the band
							// above carries the lot and this one renders nothing at all.
							<ul>
								{rest.map((t) => (
									<TaskRowItem
										key={t.id}
										task={t}
										todayIso={todayIso}
										handlers={handlersFor(t)}
										noteId={taskNoteIds?.[t.id]}
										mentions={taskMentions?.[t.id]}
									/>
								))}
							</ul>
						)}
					</section>

					{recentDoneBand.length > 0 && (
						<section className="mt-9" aria-label="Recently completed">
							<SectionHead title="Recently done" />
							<ul>
								{recentDoneBand.map((t) => (
									<TaskRowItem
										key={t.id}
										task={t}
										todayIso={todayIso}
										handlers={handlersFor(t)}
										noteId={taskNoteIds?.[t.id]}
										mentions={taskMentions?.[t.id]}
										tz={tz}
									/>
								))}
							</ul>
						</section>
					)}
				</>
			)}

			{status === "today" && (
				<section className="mt-9" aria-label="Tasks due today">
					<SectionHead title="Today" />
					{todayTasks.length === 0 ? (
						<EmptyState>Nothing due today.</EmptyState>
					) : (
						<ul>
							{todayTasks.map((t) => (
								<TaskRowItem
									key={t.id}
									task={t}
									todayIso={todayIso}
									handlers={handlersFor(t)}
									noteId={taskNoteIds?.[t.id]}
									mentions={taskMentions?.[t.id]}
								/>
							))}
						</ul>
					)}
				</section>
			)}

			{status === "quiet" && (
				<section className="mt-9" aria-label="Quiet">
					<SectionHead title="Quiet" />
					{quietTasks.length === 0 ? (
						<EmptyState hint="A task is quiet when it has no due date and its project is not active — pause a project, or give the task a day, to move it in or out.">
							Nothing parked.
						</EmptyState>
					) : (
						<ul>
							{quietTasks.map((t) => (
								<TaskRowItem
									key={t.id}
									task={t}
									todayIso={todayIso}
									handlers={handlersFor(t)}
									noteId={taskNoteIds?.[t.id]}
									mentions={taskMentions?.[t.id]}
								/>
							))}
						</ul>
					)}
				</section>
			)}

			{status === "overdue" && (
				<section className="mt-9" aria-label="Overdue tasks">
					<SectionHead title="Overdue" />
					{overdueTasks.length === 0 ? (
						<EmptyState hint="Everything with a date on it still has time.">
							Nothing overdue.
						</EmptyState>
					) : (
						<ul>
							{overdueTasks.map((t) => (
								<TaskRowItem
									key={t.id}
									task={t}
									todayIso={todayIso}
									handlers={handlersFor(t)}
									noteId={taskNoteIds?.[t.id]}
									mentions={taskMentions?.[t.id]}
								/>
							))}
						</ul>
					)}
				</section>
			)}
		</div>
	);
}
