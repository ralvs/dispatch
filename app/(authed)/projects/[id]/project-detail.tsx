"use client";

import { useRef, useState, useTransition } from "react";
import { ColorDot } from "@/components/color-dot";
import {
	Button,
	Card,
	Checkbox,
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
import type { MilestoneRow, ProjectRow } from "@/lib/services/projects";
import { milestoneProgress } from "@/lib/services/projects-shared";
import {
	ENGAGEMENT_TYPES,
	engagementTypeLabel,
	KINDS,
	kindLabel,
	PROJECT_TYPES,
	projectTypeLabel,
	statusLabel,
} from "../constants";
import {
	archiveProjectAction,
	completeProjectAction,
	createMilestoneAction,
	deleteMilestoneAction,
	toggleMilestoneAction,
	updateProjectAction,
} from "./actions";

export function ProjectDetail({
	project,
	milestones,
	domains,
}: {
	project: ProjectRow;
	milestones: MilestoneRow[];
	domains: DomainRow[];
}) {
	const [pending, startTransition] = useTransition();
	const [editing, setEditing] = useState(false);
	const domain = domains.find((d) => d.id === project.domain_id);
	const doneCount = milestones.filter((m) => m.status === "done").length;

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
			{/* Name is the title; type + status are facts (plain), milestones
			    the measure (Pass 4.5 Gate A). Domain rides the subtitle with its
			    colour — the list row already settled that domain, not project
			    colour, is the colour that leads. */}
			<PageHeader
				title={project.name}
				facts={[
					...(project.type ? [projectTypeLabel(project.type)] : []),
					statusLabel(project.status),
				]}
				measure={
					milestones.length > 0
						? [{ count: `${doneCount}/${milestones.length}`, label: "milestones" }]
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
								<Field label="Engagement">
									<Select name="engagement_type" defaultValue={project.engagement_type}>
										{ENGAGEMENT_TYPES.map((e) => (
											<option key={e.value} value={e.value}>
												{e.label}
											</option>
										))}
									</Select>
								</Field>
								<Field label="Quoted hours">
									<Input
										name="quoted_hours"
										type="number"
										min="0"
										step="0.5"
										defaultValue={project.quoted_hours ?? ""}
									/>
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
								<dt className="font-mono text-eyebrow uppercase text-ink-3">Engagement</dt>
								<dd>{engagementTypeLabel(project.engagement_type)}</dd>
							</div>
							<div>
								<dt className="font-mono text-eyebrow uppercase text-ink-3">Quoted hours</dt>
								<dd>{project.quoted_hours ?? "—"}</dd>
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

			<MilestonesSection projectId={project.id} milestones={milestones} />
		</div>
	);
}

function MilestonesSection({
	projectId,
	milestones,
}: {
	projectId: string;
	milestones: MilestoneRow[];
}) {
	const formRef = useRef<HTMLFormElement>(null);
	const [pending, startTransition] = useTransition();
	const [open, setOpen] = useState(false);
	const progress = milestoneProgress(milestones);

	function submit(formData: FormData) {
		startTransition(async () => {
			const ok = await runAction(
				() => createMilestoneAction(projectId, formData),
				"Couldn't add milestone.",
			);
			if (!ok) return;
			formRef.current?.reset();
			setOpen(false);
		});
	}

	return (
		<section className="mt-9" aria-label="Milestones">
			<SectionHead title="Milestones" aside={`${Math.round(progress * 100)}%`} />
			<div
				className="mt-2 h-1.5 w-full bg-line"
				role="progressbar"
				aria-valuenow={Math.round(progress * 100)}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label="Milestone progress"
			>
				<div className="h-full bg-ink" style={{ width: `${progress * 100}%` }} />
			</div>

			<ul className="mt-3">
				{milestones.map((m) => (
					<ListRow
						key={m.id}
						leading={
							<Checkbox
								checked={m.status === "done"}
								disabled={pending}
								onChange={(e) => {
									const done = e.currentTarget.checked;
									startTransition(async () => {
										await runAction(
											() => toggleMilestoneAction(projectId, m.id, done),
											"Couldn't update milestone.",
										);
									});
								}}
								aria-label={`Mark milestone "${m.title}" ${m.status === "done" ? "open" : "done"}`}
							/>
						}
						trailing={
							<Button
								type="button"
								variant="danger-soft"
								size="sm"
								aria-label={`Delete milestone "${m.title}"`}
								disabled={pending}
								onClick={() =>
									startTransition(async () => {
										await runAction(
											() => deleteMilestoneAction(projectId, m.id),
											"Couldn't delete milestone.",
										);
									})
								}
							>
								Delete
							</Button>
						}
					>
						<div className="flex min-w-0 items-baseline gap-2">
							<span className={rowTitle({ tone: m.status === "done" ? "done" : "default" })}>
								{m.title}
							</span>
							<span className="shrink-0 font-mono text-meta text-ink-4">w{m.weight}</span>
						</div>
					</ListRow>
				))}
			</ul>

			{open ? (
				<form ref={formRef} action={submit} className="mt-3">
					<Card className="space-y-3" padding="compact">
						<div className="grid grid-cols-3 gap-2">
							<Field label="Title" className="col-span-2">
								<Input name="title" required />
							</Field>
							<Field label="Weight">
								<Input name="weight" type="number" min="1" step="1" placeholder="1" />
							</Field>
						</div>
						<div className="flex justify-end gap-2">
							<Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
								Cancel
							</Button>
							<Button
								type="submit"
								variant="primary"
								size="sm"
								isPending={pending}
								disabled={pending}
							>
								Add
							</Button>
						</div>
					</Card>
				</form>
			) : (
				<Button
					type="button"
					variant="tertiary"
					fullWidth
					className="mt-3 justify-start"
					onClick={() => setOpen(true)}
				>
					+ Add milestone
				</Button>
			)}
		</section>
	);
}
