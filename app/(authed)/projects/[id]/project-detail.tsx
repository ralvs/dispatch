"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
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
import { completeTaskAction, reopenTaskAction, setTop3Action } from "@/lib/actions/tasks";
import { toastError } from "@/lib/client/toast";
import { nowUtc } from "@/lib/dates";
import { ProjectStatusSchema } from "@/lib/schemas/project";
import type { DomainRow } from "@/lib/services/domains";
import type { ProjectRow } from "@/lib/services/projects";
import { taskProgress } from "@/lib/services/projects-shared";
import type { TaskRow } from "@/lib/services/tasks";
import { isNavigationError, useRunIntent, useStoreWrite, useView, viewKey } from "@/lib/store";
import { bindTaskHandlers, useTaskIntentRunner } from "@/lib/task-interaction/run-intent";
import { AddTaskButton } from "../add-task-button";
import { statusLabel } from "../constants";
import { archiveProjectAction, completeProjectAction, updateProjectAction } from "./actions";

const NO_TASKS: TaskRow[] = [];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SAVE_ERROR = "Couldn't save project.";

/** What an edit asks for, so the page shows it while the server writes it. */
function projectPatch(formData: FormData, domains: DomainRow[]): Partial<ProjectRow> {
	const text = (key: string) => {
		const value = String(formData.get(key) ?? "").trim();
		return value === "" ? null : value;
	};
	const date = (key: string) => {
		const value = text(key);
		return value && DATE.test(value) ? value : null;
	};
	const name = text("name");
	const domain = domains.find((d) => d.id === text("domain_id"));
	const status = ProjectStatusSchema.safeParse(formData.get("status"));
	return {
		...(name ? { name } : {}),
		description: text("description"),
		start_date: date("start_date"),
		target_date: date("target_date"),
		...(domain
			? {
					domain_id: domain.id,
					domain: { id: domain.id, name: domain.name, color: domain.color },
				}
			: {}),
		...(status.success ? { status: status.data } : {}),
	};
}

/**
 * The project and its tasks come from the entity store views the page's
 * <Seed> fed: the project (#30), and every task tagged with it, open and done
 * (#26, shape plan §02). An edit here shows on /projects too.
 */
export function ProjectDetail({
	projectId,
	projects,
	domains,
	todayIso,
}: {
	projectId: string;
	/** Every project, for the add-task form's project picker. */
	projects: Pick<ProjectRow, "id" | "name" | "domain_id">[];
	domains: DomainRow[];
	/** App-timezone today (docs/adr/0002) — recurrence rolls from this. */
	todayIso: string;
}) {
	const [pending, startTransition] = useTransition();
	const [editing, setEditing] = useState(false);
	const project = useView(viewKey.projectHead(projectId))?.[0];
	const optTasks = useView(viewKey.project(projectId)) ?? NO_TASKS;
	const run = useTaskIntentRunner();
	const edit = useStoreWrite("project");
	const runProject = useRunIntent("project", { errorMessage: "Couldn't update project." });
	const domainOptions = domains.map((d) => ({ id: d.id, name: d.name, color: d.color }));

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

	// Projects are never deleted from here; gone means deleted elsewhere.
	if (!project) {
		return (
			<EmptyState>
				This project is gone. <Link href="/projects">Back to Projects</Link>
			</EmptyState>
		);
	}
	const domain = domains.find((d) => d.id === project.domain_id);

	function saveDetails(formData: FormData) {
		startTransition(async () => {
			try {
				const result = await edit(
					{ type: "patch", id: projectId, patch: projectPatch(formData, domains) },
					() => updateProjectAction(projectId, formData),
				);
				if (result.ok) setEditing(false);
				else toastError(result.formError ?? SAVE_ERROR);
			} catch (error) {
				// A redirect() (an expired session) navigates on its own; it is not a failure.
				if (!isNavigationError(error)) toastError(SAVE_ERROR);
			}
		});
	}

	return (
		<div className={pending ? "opacity-50" : ""}>
			{/* Name is the title; status is the fact (plain), the task
			    rollup the measure (Pass 4.5 Gate A). Domain rides the subtitle
			    with its colour — the list row already settled that domain, not
			    project colour, is the colour that leads. */}
			<PageHeader
				title={project.name}
				facts={[statusLabel(project.status)]}
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
				action={
					// "Add task", pre-filled and locked to this project. Lives on the
					// header so the list rows can rest (ADR-0044).
					<AddTaskButton
						project={{ id: project.id, name: project.name, domain_id: project.domain_id }}
						domainId={project.domain_id}
						projects={projects}
						domains={domainOptions}
						todayIso={todayIso}
					/>
				}
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
									<Select name="domain_id" defaultValue={project.domain_id} required>
										{domains.map((d) => (
											<option key={d.id} value={d.id}>
												{d.name}
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
									onClick={() =>
										runProject(
											{
												type: "patch",
												id: projectId,
												patch: { status: "done", completed_at: nowUtc() },
											},
											() => completeProjectAction(projectId),
										)
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
									onClick={() =>
										runProject(
											{ type: "patch", id: projectId, patch: { status: "archived" } },
											() => archiveProjectAction(projectId),
										)
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
										href={`/tasks/${t.id}`}
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
