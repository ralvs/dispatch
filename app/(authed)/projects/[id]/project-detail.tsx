"use client";

import { useRef, useState, useTransition } from "react";
import { runAction } from "@/lib/client/toast";
import type { DomainRow } from "@/lib/services/domains";
import type { MilestoneRow, ProjectRow } from "@/lib/services/projects";
import { milestoneProgress } from "@/lib/services/projects-shared";
import {
	archiveProjectAction,
	completeProjectAction,
	createMilestoneAction,
	deleteMilestoneAction,
	toggleMilestoneAction,
	updateProjectAction,
} from "./actions";

const PROJECT_TYPES = [
	{ value: "", label: "Unspecified" },
	{ value: "client", label: "Client" },
	{ value: "internal", label: "Internal" },
	{ value: "content", label: "Content" },
];

const KINDS = [
	{ value: "project", label: "Project" },
	{ value: "area", label: "Area" },
];

const ENGAGEMENT_TYPES = [
	{ value: "project", label: "Project" },
	{ value: "retainer", label: "Retainer" },
];

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
	const domainName = domains.find((d) => d.id === project.domain_id)?.name;

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
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Project</p>
				<h1 className="mt-1 flex items-center gap-2 font-serif text-3xl text-ink">
					{project.color && (
						<span
							aria-hidden="true"
							className="inline-block size-3 rounded-full"
							style={{ backgroundColor: project.color }}
						/>
					)}
					{project.name}
				</h1>
				<p className="mt-1 font-mono text-eyebrow uppercase tracking-widest text-ink-4">
					{project.status}
					{domainName ? ` · ${domainName}` : ""}
				</p>
			</header>

			<section className="mt-6" aria-label="Details">
				{editing ? (
					<form
						action={saveDetails}
						className="space-y-3 rounded-xl border border-line-strong bg-surface p-4"
					>
						<label className="block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Name</span>
							<input
								name="name"
								required
								defaultValue={project.name}
								className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
							/>
						</label>
						<label className="block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Description</span>
							<textarea
								name="description"
								rows={2}
								defaultValue={project.description ?? ""}
								className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
							/>
						</label>
						<div className="grid grid-cols-2 gap-3">
							<label className="block">
								<span className="font-mono text-eyebrow uppercase text-ink-3">Domain</span>
								<select
									name="domain_id"
									defaultValue={project.domain_id ?? ""}
									className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
								>
									<option value="">Unassigned</option>
									{domains.map((d) => (
										<option key={d.id} value={d.id}>
											{d.name}
										</option>
									))}
								</select>
							</label>
							<label className="block">
								<span className="font-mono text-eyebrow uppercase text-ink-3">Type</span>
								<select
									name="type"
									defaultValue={project.type ?? ""}
									className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
								>
									{PROJECT_TYPES.map((t) => (
										<option key={t.value} value={t.value}>
											{t.label}
										</option>
									))}
								</select>
							</label>
							<label className="block">
								<span className="font-mono text-eyebrow uppercase text-ink-3">Kind</span>
								<select
									name="kind"
									defaultValue={project.kind}
									className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
								>
									{KINDS.map((k) => (
										<option key={k.value} value={k.value}>
											{k.label}
										</option>
									))}
								</select>
							</label>
							<label className="block">
								<span className="font-mono text-eyebrow uppercase text-ink-3">Engagement</span>
								<select
									name="engagement_type"
									defaultValue={project.engagement_type}
									className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
								>
									{ENGAGEMENT_TYPES.map((e) => (
										<option key={e.value} value={e.value}>
											{e.label}
										</option>
									))}
								</select>
							</label>
							<label className="block">
								<span className="font-mono text-eyebrow uppercase text-ink-3">Quoted hours</span>
								<input
									name="quoted_hours"
									type="number"
									min="0"
									step="0.5"
									defaultValue={project.quoted_hours ?? ""}
									className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
								/>
							</label>
							<label className="block">
								<span className="font-mono text-eyebrow uppercase text-ink-3">Start date</span>
								<input
									name="start_date"
									type="date"
									defaultValue={project.start_date ?? ""}
									className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
								/>
							</label>
							<label className="block">
								<span className="font-mono text-eyebrow uppercase text-ink-3">Target date</span>
								<input
									name="target_date"
									type="date"
									defaultValue={project.target_date ?? ""}
									className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
								/>
							</label>
						</div>
						<div className="flex gap-2 pt-1">
							<button
								type="submit"
								disabled={pending}
								className="rounded-md bg-ink px-4 py-2 font-mono text-eyebrow uppercase tracking-widest text-bg disabled:opacity-50"
							>
								Save
							</button>
							<button
								type="button"
								onClick={() => setEditing(false)}
								className="px-3 py-2 font-mono text-eyebrow uppercase tracking-widest text-ink-3"
							>
								Cancel
							</button>
						</div>
					</form>
				) : (
					<div>
						<dl className="grid grid-cols-2 gap-2 text-sm text-ink">
							<div>
								<dt className="font-mono text-eyebrow uppercase text-ink-3">Type</dt>
								<dd>{project.type ?? "—"}</dd>
							</div>
							<div>
								<dt className="font-mono text-eyebrow uppercase text-ink-3">Kind</dt>
								<dd>{project.kind}</dd>
							</div>
							<div>
								<dt className="font-mono text-eyebrow uppercase text-ink-3">Engagement</dt>
								<dd>{project.engagement_type}</dd>
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
							<button
								type="button"
								aria-label={`Edit ${project.name}`}
								onClick={() => setEditing(true)}
								className="rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
							>
								Edit
							</button>
							{project.status !== "done" && (
								<button
									type="button"
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
									className="rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
								>
									Mark done
								</button>
							)}
							{project.status !== "archived" && (
								<button
									type="button"
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
									className="rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-accent-slip hover:border-accent-slip"
								>
									Archive
								</button>
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
		<section className="mt-8" aria-label="Milestones">
			<div className="flex items-baseline justify-between">
				<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">Milestones</h2>
				<span className="font-mono text-meta text-ink-4">{Math.round(progress * 100)}%</span>
			</div>
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
					<li key={m.id} className="hairline flex items-center justify-between gap-3 py-2">
						<label className="flex items-center gap-2">
							<input
								type="checkbox"
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
							<span
								className={`text-sm ${m.status === "done" ? "text-ink-4 line-through" : "text-ink"}`}
							>
								{m.title}
							</span>
							<span className="font-mono text-meta text-ink-4">w{m.weight}</span>
						</label>
						<button
							type="button"
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
							className="shrink-0 font-mono text-meta text-ink-4 hover:text-accent-slip"
						>
							Delete
						</button>
					</li>
				))}
			</ul>

			{open ? (
				<form
					ref={formRef}
					action={submit}
					className="mt-2 space-y-2 rounded-xl border border-line-strong bg-surface p-3"
				>
					<div className="grid grid-cols-3 gap-2">
						<label className="col-span-2 block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Title</span>
							<input
								name="title"
								required
								className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
							/>
						</label>
						<label className="block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Weight</span>
							<input
								name="weight"
								type="number"
								min="1"
								step="1"
								placeholder="1"
								className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
							/>
						</label>
					</div>
					<div className="flex gap-2">
						<button
							type="submit"
							disabled={pending}
							className="rounded-md bg-ink px-3 py-1.5 font-mono text-eyebrow uppercase tracking-widest text-bg disabled:opacity-50"
						>
							Add
						</button>
						<button
							type="button"
							onClick={() => setOpen(false)}
							className="px-3 py-1.5 font-mono text-eyebrow uppercase tracking-widest text-ink-3"
						>
							Cancel
						</button>
					</div>
				</form>
			) : (
				<button
					type="button"
					onClick={() => setOpen(true)}
					className="mt-2 w-full rounded-md border border-line px-3 py-2 text-left font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
				>
					+ Add milestone
				</button>
			)}
		</section>
	);
}
