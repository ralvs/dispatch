"use client";

import Link from "next/link";
import { ColorDot } from "@/components/color-dot";
import {
	Button,
	Card,
	Checkbox,
	EmptyState,
	Field,
	FormStateProvider,
	Input,
	ListRow,
	PageHeader,
	rowTitle,
	SectionHead,
	Select,
	Textarea,
} from "@/components/ui";
import type { DomainRow } from "@/lib/services/domains";
import type { ProjectRow } from "@/lib/services/projects";
import { taskProgress } from "@/lib/services/projects-shared";
import type { TaskRow } from "@/lib/services/tasks";
import { useInlineEdit, useView, useWrites, viewKey } from "@/lib/store";
import { bindTaskHandlers } from "@/lib/task-interaction/run-intent";
import { AddTaskButton } from "../add-task-button";
import { statusLabel } from "../constants";
import { projectDetailWrites } from "./writes";

const NO_TASKS: TaskRow[] = [];
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
	const edit = useInlineEdit({ fieldErrors: true });
	const project = useView(viewKey.projectHead(projectId))?.[0];
	const optTasks = useView(viewKey.project(projectId)) ?? NO_TASKS;
	const writes = useWrites();
	const domainOptions = domains.map((d) => ({ id: d.id, name: d.name, color: d.color }));

	const openTasks = optTasks.filter((t) => t.status !== "done");
	const doneTasks = optTasks.filter((t) => t.status === "done");

	function handlersFor(task: TaskRow) {
		return bindTaskHandlers(task, writes, { top3DateIso: todayIso, todayIso });
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
		edit.submit(projectDetailWrites.update(projectId, formData, domains));
	}

	return (
		<div className={edit.pending ? "opacity-50" : ""}>
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
				{edit.editing ? (
					<FormStateProvider state={edit.formState}>
						<form
							action={saveDetails}
							onChange={(e) => {
								const name = (e.target as Element).getAttribute("name");
								if (name) edit.clearField(name);
							}}
						>
							<Card className="space-y-4" padding="default">
								<Field label="Name" name="name">
									<Input name="name" required defaultValue={project.name} />
								</Field>
								<Field label="Description" name="description">
									<Textarea
										name="description"
										rows={2}
										defaultValue={project.description ?? ""}
										size="sm"
									/>
								</Field>
								<div className="grid grid-cols-2 gap-3">
									<Field label="Domain" name="domain_id">
										<Select name="domain_id" defaultValue={project.domain_id} required>
											{domains.map((d) => (
												<option key={d.id} value={d.id}>
													{d.name}
												</option>
											))}
										</Select>
									</Field>
									<Field label="Start date" name="start_date">
										<Input name="start_date" type="date" defaultValue={project.start_date ?? ""} />
									</Field>
									<Field label="Target date" name="target_date">
										<Input
											name="target_date"
											type="date"
											defaultValue={project.target_date ?? ""}
										/>
									</Field>
								</div>
								<div className="flex justify-end gap-2 pt-1">
									<Button type="button" variant="ghost" onClick={edit.close}>
										Cancel
									</Button>
									<Button
										type="submit"
										variant="primary"
										isPending={edit.pending}
										disabled={edit.pending}
									>
										Save
									</Button>
								</div>
							</Card>
						</form>
					</FormStateProvider>
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
								onClick={edit.open}
							>
								Edit
							</Button>
							{project.status !== "done" && (
								<Button
									type="button"
									variant="tertiary"
									size="sm"
									aria-label={`Mark ${project.name} done`}
									onClick={() => writes.send(projectDetailWrites.complete(projectId))}
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
									onClick={() => writes.send(projectDetailWrites.archive(projectId))}
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
