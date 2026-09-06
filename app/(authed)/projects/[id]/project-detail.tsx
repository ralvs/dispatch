"use client";

import Link from "next/link";
import { type ReactNode, useOptimistic, useState, useTransition } from "react";
import { completeTaskAction, reopenTaskAction, setTop3Action } from "@/app/(authed)/tasks/actions";
import { ColorDot } from "@/components/color-dot";
import {
	Button,
	Card,
	Checkbox,
	EmptyState,
	Field,
	Input,
	ListRow,
	PageHeader,
	rowTitle,
	SectionHead,
	Select,
	Textarea,
} from "@/components/ui";
import { runAction } from "@/lib/client/toast";
import type { DomainRow } from "@/lib/services/domains";
import type { ProjectRow } from "@/lib/services/projects";
import { taskProgress } from "@/lib/services/projects-shared";
import type { TaskRow } from "@/lib/services/tasks";
import {
	type ApplyContext,
	completeTaskFields,
	reopenTaskFields,
	type TaskIntent,
} from "@/lib/task-interaction/apply-intent";
import { bindTaskHandlers, useTaskIntentRunner } from "@/lib/task-interaction/run-intent";
import { KINDS, kindLabel, PROJECT_TYPES, projectTypeLabel, statusLabel } from "../constants";
import { archiveProjectAction, completeProjectAction, updateProjectAction } from "./actions";

/** Flat-list projector — `applyTaskLists` caps done at 10 for the Tasks page. */
function applyProjectTasks(tasks: TaskRow[], intent: TaskIntent, ctx: ApplyContext): TaskRow[] {
	if (intent.type === "complete") {
		const task = tasks.find((t) => t.id === intent.id);
		if (!task) return tasks;
		const next = completeTaskFields(task, ctx, { clearTop3: false });
		return tasks.map((t) => (t.id === intent.id ? next : t));
	}
	if (intent.type === "reopen") {
		const task = tasks.find((t) => t.id === intent.id);
		if (!task) return tasks;
		return tasks.map((t) => (t.id === intent.id ? reopenTaskFields(t) : t));
	}
	return tasks;
}

export function ProjectDetail({
	project,
	tasks,
	domains,
	todayIso,
	addTask,
}: {
	project: ProjectRow;
	/** Every task tagged with this project, open and done (shape plan §02). */
	tasks: TaskRow[];
	domains: DomainRow[];
	/** App-timezone today (docs/adr/0002) — recurrence rolls from this. */
	todayIso: string;
	/**
	 * "Add task", pre-filled and locked to this project. Lives on the header
	 * so the list rows can rest (ADR-0044).
	 */
	addTask?: ReactNode;
}) {
	const [pending, startTransition] = useTransition();
	const [editing, setEditing] = useState(false);
	const domain = domains.find((d) => d.id === project.domain_id);
	const ctx: ApplyContext = { todayIso };
	const [optTasks, dispatchOptimistic] = useOptimistic(tasks, (current, intent: TaskIntent) =>
		applyProjectTasks(current, intent, ctx),
	);
	const run = useTaskIntentRunner(dispatchOptimistic);
	const openTasks = optTasks.filter((t) => t.status !== "done");
	const doneTasks = optTasks.filter((t) => t.status === "done");

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

	function saveDetails(formData: FormData) {
		startTransition(async () => {
			const ok = await runAction(
				() => updateProjectAction(project.id, formData),
				"Couldn't save project.",
			);
			if (ok) setEditing(false);
		});
	}

	return (
		<div className={pending ? "opacity-50" : ""}>
			<nav aria-label="Breadcrumb" className="pb-4">
				<Link
					href="/projects"
					className="font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:text-ink"
				>
					← Projects
				</Link>
			</nav>
			{/* Name is the title; type + status are facts (plain), the task
			    rollup the measure (Pass 4.5 Gate A). Domain rides the subtitle
			    with its colour — the list row already settled that domain, not
			    project colour, is the colour that leads. */}
			<PageHeader
				title={project.name}
				facts={[
					...(project.type ? [projectTypeLabel(project.type)] : []),
					statusLabel(project.status),
				]}
				measure={
					optTasks.length > 0
						? [{ count: `${doneTasks.length}/${optTasks.length}`, label: "tasks done" }]
						: undefined
				}
				subtitle={
					domain ? (
						<span className="inline-flex items-center gap-1.5">
							<ColorDot color={domain.color} />
							{domain.name}
						</span>
					) : undefined
				}
				action={addTask}
			/>

			<section aria-label="Details">
				{editing ? (
					<form action={saveDetails}>
						<Card className="space-y-4" padding="default">
							<Field label="Name">
								<Input name="name" required defaultValue={project.name} />
							</Field>
							<Field label="Description">
								<Textarea
									name="description"
									rows={2}
									defaultValue={project.description ?? ""}
									size="sm"
								/>
							</Field>
							<div className="grid grid-cols-2 gap-3">
								<Field label="Domain">
									<Select name="domain_id" defaultValue={project.domain_id ?? ""}>
										<option value="">Unassigned</option>
										{domains.map((d) => (
											<option key={d.id} value={d.id}>
												{d.name}
											</option>
										))}
									</Select>
								</Field>
								<Field label="Type">
									<Select name="type" defaultValue={project.type ?? ""}>
										{PROJECT_TYPES.map((t) => (
											<option key={t.value} value={t.value}>
												{t.label}
											</option>
										))}
									</Select>
								</Field>
								<Field label="Kind">
									<Select name="kind" defaultValue={project.kind}>
										{KINDS.map((k) => (
											<option key={k.value} value={k.value}>
												{k.label}
											</option>
										))}
									</Select>
								</Field>
								<Field label="Start date">
									<Input name="start_date" type="date" defaultValue={project.start_date ?? ""} />
								</Field>
								<Field label="Target date">
									<Input name="target_date" type="date" defaultValue={project.target_date ?? ""} />
								</Field>
							</div>
							<div className="flex justify-end gap-2 pt-1">
								<Button type="button" variant="ghost" onClick={() => setEditing(false)}>
									Cancel
								</Button>
								<Button type="submit" variant="primary" isPending={pending} disabled={pending}>
									Save
								</Button>
							</div>
						</Card>
					</form>
				) : (
					<div>
						<dl className="grid grid-cols-2 gap-2 text-sm text-ink">
							<div>
								<dt className="font-mono text-eyebrow uppercase text-ink-3">Type</dt>
								<dd>{project.type ? projectTypeLabel(project.type) : "—"}</dd>
							</div>
							<div>
								<dt className="font-mono text-eyebrow uppercase text-ink-3">Kind</dt>
								<dd>{kindLabel(project.kind)}</dd>
							</div>
							<div>
								<dt className="font-mono text-eyebrow uppercase text-ink-3">Start date</dt>
								<dd>{project.start_date ?? "—"}</dd>
							</div>
							<div>
								<dt className="font-mono text-eyebrow uppercase text-ink-3">Target date</dt>
								<dd>{project.target_date ?? "—"}</dd>
							</div>
							{project.description && (
								<div className="col-span-2">
									<dt className="font-mono text-eyebrow uppercase text-ink-3">Description</dt>
									<dd className="whitespace-pre-wrap">{project.description}</dd>
								</div>
							)}
						</dl>
						<div className="mt-3 flex flex-wrap gap-2">
							<Button
								type="button"
								variant="tertiary"
								size="sm"
								aria-label={`Edit ${project.name}`}
								onClick={() => setEditing(true)}
							>
								Edit
							</Button>
							{project.status !== "done" && (
								<Button
									type="button"
									variant="tertiary"
									size="sm"
									aria-label={`Mark ${project.name} done`}
									disabled={pending}
									onClick={() =>
										startTransition(async () => {
											await runAction(
												() => completeProjectAction(project.id),
												"Couldn't complete project.",
											);
										})
									}
								>
									Mark done
								</Button>
							)}
							{project.status !== "archived" && (
								<Button
									type="button"
									variant="danger"
									size="sm"
									aria-label={`Archive ${project.name}`}
									disabled={pending}
									onClick={() =>
										startTransition(async () => {
											await runAction(
												() => archiveProjectAction(project.id),
												"Couldn't archive project.",
											);
										})
									}
								>
									Archive
								</Button>
							)}
						</div>
					</div>
				)}
			</section>

			<ProjectTasksSection
				projectId={project.id}
				open={openTasks}
				done={doneTasks}
				handlersFor={handlersFor}
			/>
		</div>
	);
}

/**
 * A project is a loose bucket that tags tasks (shape plan §02), so the page
 * that names one has to show what is in it. Milestones used to stand here — a
 * second checklist that measured itself, and moved only when you remembered
 * to tick it.
 *
 * Open work leads; finished work follows, because the project page is where
 * done work belongs (plan O5 keeps it off the list rows).
 */
function ProjectTasksSection({
	projectId,
	open,
	done,
	handlersFor,
}: {
	projectId: string;
	open: TaskRow[];
	done: TaskRow[];
	handlersFor: (task: TaskRow) => { onToggleDone: () => void };
}) {
	const total = open.length + done.length;
	const progress = taskProgress({ done: done.length, open: open.length });

	return (
		<section className="mt-9" aria-label="Tasks">
			<SectionHead
				title="Tasks"
				aside={
					total > 0 ? (
						<span className="font-mono text-meta text-ink-3">{Math.round(progress * 100)}%</span>
					) : undefined
				}
			/>
			{total === 0 ? (
				<EmptyState hint="Add one with the + at the top of the page.">
					Nothing tagged with this project.
				</EmptyState>
			) : (
				<>
					<div
						className="mt-2 h-1.5 w-full bg-line"
						role="progressbar"
						aria-valuenow={Math.round(progress * 100)}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-label="Tasks done"
					>
						<div className="h-full bg-ink" style={{ width: `${progress * 100}%` }} />
					</div>

					<ul className="mt-3">
						{[...open, ...done].map((t) => {
							const doneRow = t.status === "done";
							return (
								<ListRow
									key={t.id}
									leading={
										<Checkbox
											checked={doneRow}
											priority={t.priority}
											aria-label={doneRow ? `Reopen "${t.title}"` : `Complete "${t.title}"`}
											onChange={handlersFor(t).onToggleDone}
											className="shrink-0"
										/>
									}
								>
									<Link
										href={`/tasks?edit=${t.id}`}
										className={rowTitle({
											tone: doneRow ? "done" : "default",
											className: "hover:text-accent-ink",
										})}
									>
										{t.title}
									</Link>
								</ListRow>
							);
						})}
					</ul>

					<Link
						href={`/tasks?project=${projectId}`}
						className="mt-3 inline-block font-mono text-meta text-accent-ink"
					>
						Open in Tasks →
					</Link>
				</>
			)}
		</section>
	);
}
