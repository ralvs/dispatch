"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import type { MentionCandidate } from "@/lib/mentions";
import type { TaskRow } from "@/lib/services/tasks";
import {
	type ApplyContext,
	applyTaskLists,
	type TaskIntent,
	type TaskLists,
} from "@/lib/task-interaction/apply-intent";
import { bindTaskHandlers, useTaskIntentRunner } from "@/lib/task-interaction/run-intent";
import { isDueToday, isOverdue, isTop3Today, TOP3_SLOTS } from "@/lib/task-predicates";
import {
	completeTaskAction,
	createTaskAction,
	deleteTaskAction,
	quickAddTaskAction,
	reopenTaskAction,
	setTop3Action,
} from "./actions";
import { CaptureBar } from "./capture-bar";
import type { TaskDomainOption } from "./task-fields";
import {
	type TaskFilterOption,
	TaskScopeFilters,
	type TaskStatusFilter,
	TaskStatusStrip,
	UNFILED,
} from "./task-filters";
import { TaskRowItem } from "./task-row";

function isTaskStatusFilter(value: string | undefined): value is TaskStatusFilter {
	return value === "open" || value === "overdue" || value === "today";
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

/** A new task as the client can know it: unfiled, no server round-trip. */
function optimisticTask(overrides: Partial<TaskRow> = {}): TaskRow {
	return {
		id: crypto.randomUUID(),
		title: "Untitled",
		notes: null,
		status: "open",
		due_date: null,
		due_time: null,
		priority: 4,
		project_id: null,
		domain_id: null,
		recurrence_rule: null,
		top3_for_date: null,
		source: "manual",
		created_at: new Date().toISOString(),
		completed_at: null,
		domain: null,
		project: null,
		...overrides,
	};
}

/** Raw text — everything else defaults; the parsed row swaps in on revalidation. */
function optimisticTaskFromText(text: string): TaskRow {
	return optimisticTask({ title: text });
}

function optimisticTaskFromForm(formData: FormData, domains: TaskDomainOption[]): TaskRow {
	const domainId = String(formData.get("domain_id") ?? "") || null;
	const domain = domains.find((d) => d.id === domainId);
	const priorityRaw = Number(formData.get("priority"));

	return optimisticTask({
		title: String(formData.get("title") ?? "").trim() || "Untitled",
		notes: String(formData.get("notes") ?? "") || null,
		due_date: String(formData.get("due_date") ?? "") || null,
		due_time: String(formData.get("due_time") ?? "") || null,
		priority: Number.isFinite(priorityRaw) ? priorityRaw : 4,
		domain_id: domainId,
		recurrence_rule: String(formData.get("recurrence_rule") ?? "") || null,
		domain: domain ? { id: domain.id, name: domain.name, color: domain.color ?? null } : null,
	});
}

export function TaskList({
	openTasks,
	doneTasks,
	todayIso,
	domains,
	projects,
	editTaskId,
	initialStatus,
	initialProjectId,
	initialDomainId,
	taskNoteIds,
	tz,
	people = [],
	taskMentions,
	inboxCount = 0,
}: {
	openTasks: TaskRow[];
	doneTasks: TaskRow[];
	todayIso: string;
	domains: TaskDomainOption[];
	projects?: TaskFilterOption[];
	/** From `?edit=` — opens that row's form and cleans the URL. */
	editTaskId?: string | null;
	/** From `?status=` — initial value only; every later change is client state. */
	initialStatus?: string;
	/** From `?project=` — same deep-link contract as initialStatus. */
	initialProjectId?: string;
	/** From `?domain=` — same deep-link contract as initialStatus. */
	initialDomainId?: string;
	/** task id -> linked note id, for the linked-note glyph on rows. */
	taskNoteIds?: Record<string, string>;
	/** App timezone — threaded to rows so "Recently done" can show a completion time. */
	tz: string;
	/** @mention candidates (docs/adr/0030) for the capture bar and edit-form autocomplete. */
	people?: MentionCandidate[];
	/** task id -> people already mentioned in it, for the mention chips on rows. */
	taskMentions?: Record<string, { id: string; name: string }[]>;
	/** Unfiled open tasks — surfaced as the header's link to /inbox. */
	inboxCount?: number;
}) {
	const router = useRouter();
	const [, startTransition] = useTransition();
	const seed: TaskLists = { open: openTasks, done: doneTasks };
	const ctx: ApplyContext = { todayIso };

	const [lists, dispatchOptimistic] = useOptimistic(seed, (current, intent: TaskIntent) =>
		applyTaskLists(current, intent, ctx),
	);
	const run = useTaskIntentRunner(dispatchOptimistic);

	// Ids of tasks created optimistically in this session — always shown
	// regardless of the active filter, so a capture typed while "Domain: Work"
	// is active doesn't vanish just because it optimistically has no domain
	// yet. Once the server round-trip revalidates the real lists, the fake id
	// simply no longer matches any row, so nothing needs to prune this set.
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
	useEffect(() => {
		const qs = filterQuery(status, projectId, domainId);
		window.history.replaceState(null, "", `/tasks${qs}`);
	}, [status, projectId, domainId]);

	// Drop the deep-link query so a refresh doesn't re-force the form open.
	// Preserves whatever filter query is currently live rather than a bare
	// "/tasks" replace, which would otherwise clobber it on the same tick.
	// Deliberately editTaskId-only: this fires once for the deep link, not on
	// every later filter change (the effect above already handles that).
	// biome-ignore lint/correctness/useExhaustiveDependencies: status/projectId/domainId read at fire time on purpose, not tracked as triggers
	useEffect(() => {
		if (!editTaskId) return;
		router.replace(`/tasks${filterQuery(status, projectId, domainId)}`, { scroll: false });
	}, [editTaskId, router]);

	function handlersFor(task: TaskRow) {
		return bindTaskHandlers(
			task,
			run,
			{
				complete: completeTaskAction,
				reopen: reopenTaskAction,
				setTop3: setTop3Action,
				delete: deleteTaskAction,
			},
			{ top3DateIso: todayIso },
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

	const filteredOpen = lists.open.filter(matchesFilters);
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
	// filter is gone it is the only place completed work shows up.
	const recentDoneBand = filteredDone.slice(0, 10);

	function onCreate(formData: FormData): Promise<void> {
		const optimistic = optimisticTaskFromForm(formData, domains);
		sessionCreatedIds.add(optimistic.id);
		// useOptimistic must run inside a transition owned here (not only the form's).
		return new Promise((resolve, reject) => {
			startTransition(() => {
				dispatchOptimistic({ type: "create", task: optimistic });
				createTaskAction(formData)
					.then(resolve)
					.catch((err) => {
						// Collapsible form also toasts; keep reject so form stays open.
						reject(err);
					});
			});
		});
	}

	function onQuickAdd(text: string): Promise<void> {
		const optimistic = optimisticTaskFromText(text);
		sessionCreatedIds.add(optimistic.id);
		// Mirrors onCreate — same shared transition, same rollback-on-reject.
		return new Promise((resolve, reject) => {
			startTransition(() => {
				dispatchOptimistic({ type: "create", task: optimistic });
				quickAddTaskAction({ text })
					.then(resolve)
					.catch((err) => {
						reject(err);
					});
			});
		});
	}

	return (
		// The whole page lives in here, header included: the count strip is the
		// status filter now, so it has to read the same client state the list does.
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Tasks</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">The docket</h1>
				<div className="mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
					<TaskStatusStrip
						status={status}
						onStatusChange={setStatus}
						openCount={filteredOpen.length}
						overdueCount={overdueTasks.length}
						todayCount={todayTasks.length}
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
			</header>

			<CaptureBar
				domains={domains}
				todayIso={todayIso}
				onQuickAdd={onQuickAdd}
				onCreate={onCreate}
				people={people}
			/>

			{status === "open" && (
				<>
					{/* Top 3 is split here in the client, not on the server, so tapping ☆
					 * moves a row between the two groups on the same tick the star flips —
					 * both read from the one optimistic list. */}
					{top3.length > 0 && (
						<section className="mt-8" aria-label="Today's top 3">
							<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
								Top 3 · today
							</h2>
							<ul className="mt-2">
								{top3.map((t) => (
									<TaskRowItem
										key={t.id}
										task={t}
										todayIso={todayIso}
										domains={domains}
										initialEditing={editTaskId === t.id}
										handlers={handlersFor(t)}
										noteId={taskNoteIds?.[t.id]}
										people={people}
										mentions={taskMentions?.[t.id]}
									/>
								))}
							</ul>
							{slotsOpen > 0 && (
								<p className="mt-2 font-mono text-meta text-ink-4">
									{slotsOpen} slot{slotsOpen === 1 ? "" : "s"} open · tap ☆ on a row to pin
								</p>
							)}
						</section>
					)}

					<section className="mt-8" aria-label="Open tasks">
						<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Open</h2>
						{filteredOpen.length === 0 ? (
							<p className="py-8 text-center font-serif italic text-ink-3">
								Nothing on the docket. Capture something.
							</p>
						) : (
							// Everything open may already be starred, in which case the band
							// above carries the lot and this one renders nothing at all.
							<ul className="mt-2">
								{rest.map((t) => (
									<TaskRowItem
										key={t.id}
										task={t}
										todayIso={todayIso}
										domains={domains}
										initialEditing={editTaskId === t.id}
										handlers={handlersFor(t)}
										noteId={taskNoteIds?.[t.id]}
										people={people}
										mentions={taskMentions?.[t.id]}
									/>
								))}
							</ul>
						)}
					</section>

					{recentDoneBand.length > 0 && (
						<section className="mt-10" aria-label="Recently completed">
							<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">
								Recently done
							</h2>
							<ul className="mt-2">
								{recentDoneBand.map((t) => (
									<TaskRowItem
										key={t.id}
										task={t}
										todayIso={todayIso}
										domains={domains}
										initialEditing={editTaskId === t.id}
										handlers={handlersFor(t)}
										noteId={taskNoteIds?.[t.id]}
										people={people}
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
				<section className="mt-8" aria-label="Tasks due today">
					<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Today</h2>
					{todayTasks.length === 0 ? (
						<p className="py-8 text-center font-serif italic text-ink-3">Nothing due today.</p>
					) : (
						<ul className="mt-2">
							{todayTasks.map((t) => (
								<TaskRowItem
									key={t.id}
									task={t}
									todayIso={todayIso}
									domains={domains}
									initialEditing={editTaskId === t.id}
									handlers={handlersFor(t)}
									noteId={taskNoteIds?.[t.id]}
									people={people}
									mentions={taskMentions?.[t.id]}
								/>
							))}
						</ul>
					)}
				</section>
			)}

			{status === "overdue" && (
				<section className="mt-8" aria-label="Overdue tasks">
					<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Overdue</h2>
					{overdueTasks.length === 0 ? (
						<p className="py-8 text-center font-serif italic text-ink-3">Nothing overdue.</p>
					) : (
						<ul className="mt-2">
							{overdueTasks.map((t) => (
								<TaskRowItem
									key={t.id}
									task={t}
									todayIso={todayIso}
									domains={domains}
									initialEditing={editTaskId === t.id}
									handlers={handlersFor(t)}
									noteId={taskNoteIds?.[t.id]}
									people={people}
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
