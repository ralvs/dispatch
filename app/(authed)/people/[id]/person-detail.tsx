"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import {
	Button,
	Card,
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
import { formatInstant } from "@/lib/dates";
import { displayTitle } from "@/lib/note-display";
import type { PersonFactRow, PersonInteractionRow, PersonRow } from "@/lib/services/people";
import {
	FACT_TYPES,
	factTypeLabel,
	INTERACTION_TYPES,
	interactionTypeLabel,
	RELATIONSHIP_TYPES,
	relationshipLabel,
} from "../constants";
import {
	createFactAction,
	createInteractionAction,
	deleteFactAction,
	deleteInteractionAction,
	deletePersonAction,
	updatePersonAction,
} from "./actions";

export function PersonDetail({
	person,
	facts,
	interactions,
	tz,
	mentionedTasks,
	mentionedNotes,
}: {
	person: PersonRow;
	facts: PersonFactRow[];
	interactions: PersonInteractionRow[];
	tz: string;
	/** Tasks whose title/notes mention this person (docs/adr/0030 §5). */
	mentionedTasks: { id: string; title: string; status: string }[];
	/** Notes whose body mentions this person. */
	mentionedNotes: { id: string; title: string | null; body: string }[];
}) {
	const [pending, startTransition] = useTransition();
	const [editing, setEditing] = useState(false);

	function saveDetails(formData: FormData) {
		startTransition(async () => {
			const ok = await runAction(
				() => updatePersonAction(person.id, formData),
				"Couldn't save person.",
			);
			if (ok) setEditing(false);
		});
	}

	return (
		<div className={pending ? "opacity-50" : ""}>
			{/* Name is the title; relationship + company take the measure slot
			    (ADR-0042). Last two legacy hairline-strong headers leave here. */}
			<PageHeader
				title={person.name}
				measure={[
					...(person.relationship_type
						? [{ count: relationshipLabel(person.relationship_type), label: "" }]
						: []),
					...(person.company ? [{ count: person.company, label: "" }] : []),
					{ count: facts.length, label: facts.length === 1 ? "fact" : "facts" },
				]}
			/>

			<section className="mt-8" aria-label="Details">
				{editing ? (
					<form action={saveDetails}>
						<Card className="space-y-4" padding="default">
							<Field label="Name">
								<Input name="name" required defaultValue={person.name} />
							</Field>
							<div className="grid grid-cols-2 gap-3">
								<Field label="Relationship">
									<Select name="relationship_type" defaultValue={person.relationship_type ?? ""}>
										{RELATIONSHIP_TYPES.map((r) => (
											<option key={r.value} value={r.value}>
												{r.label}
											</option>
										))}
									</Select>
								</Field>
								<Field label="Company">
									<Input name="company" defaultValue={person.company ?? ""} />
								</Field>
								<Field label="Email">
									<Input name="email" type="email" defaultValue={person.email ?? ""} />
								</Field>
								<Field label="Phone">
									<Input name="phone" defaultValue={person.phone ?? ""} />
								</Field>
								<Field label="Notes" className="col-span-2">
									<Textarea name="notes" rows={3} defaultValue={person.notes ?? ""} />
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
								<dt className="font-mono text-eyebrow uppercase text-ink-3">Relationship</dt>
								<dd>
									{person.relationship_type ? relationshipLabel(person.relationship_type) : "—"}
								</dd>
							</div>
							<div>
								<dt className="font-mono text-eyebrow uppercase text-ink-3">Company</dt>
								<dd>{person.company ?? "—"}</dd>
							</div>
							<div>
								<dt className="font-mono text-eyebrow uppercase text-ink-3">Email</dt>
								<dd>{person.email ?? "—"}</dd>
							</div>
							<div>
								<dt className="font-mono text-eyebrow uppercase text-ink-3">Phone</dt>
								<dd>{person.phone ?? "—"}</dd>
							</div>
							{person.notes && (
								<div className="col-span-2">
									<dt className="font-mono text-eyebrow uppercase text-ink-3">Notes</dt>
									<dd className="whitespace-pre-wrap">{person.notes}</dd>
								</div>
							)}
						</dl>
						<div className="mt-3 flex gap-2">
							<Button
								type="button"
								variant="tertiary"
								size="sm"
								aria-label={`Edit ${person.name}`}
								onClick={() => setEditing(true)}
							>
								Edit
							</Button>
							<Button
								type="button"
								variant="danger"
								size="sm"
								aria-label={`Delete ${person.name}`}
								disabled={pending}
								onClick={() =>
									startTransition(async () => {
										await runAction(() => deletePersonAction(person.id), "Couldn't delete person.");
									})
								}
							>
								Delete
							</Button>
						</div>
					</div>
				)}
			</section>

			<MentionedInSection tasks={mentionedTasks} notes={mentionedNotes} />
			<FactsSection personId={person.id} facts={facts} />
			<InteractionsSection personId={person.id} interactions={interactions} tz={tz} />
		</div>
	);
}

/** The payoff of docs/adr/0030: every task and note that mentions this person, in one place. */
function MentionedInSection({
	tasks,
	notes,
}: {
	tasks: { id: string; title: string; status: string }[];
	notes: { id: string; title: string | null; body: string }[];
}) {
	if (tasks.length === 0 && notes.length === 0) return null;

	return (
		<section className="mt-14" aria-label="Mentioned in">
			<SectionHead title="Mentioned in" aside={String(tasks.length + notes.length)} />
			<ul>
				{tasks.map((task) => (
					<ListRow key={`task-${task.id}`}>
						<Link
							href={`/tasks?edit=${task.id}`}
							className={rowTitle({ className: "hover:text-accent-ink" })}
						>
							{task.title}
							{task.status === "done" ? " · done" : ""}
						</Link>
					</ListRow>
				))}
				{notes.map((note) => (
					<ListRow key={`note-${note.id}`}>
						<Link
							href={`/notes/${note.id}`}
							className={rowTitle({ className: "hover:text-accent-ink" })}
						>
							{displayTitle(note)}
						</Link>
					</ListRow>
				))}
			</ul>
		</section>
	);
}

function FactsSection({ personId, facts }: { personId: string; facts: PersonFactRow[] }) {
	const formRef = useRef<HTMLFormElement>(null);
	const [pending, startTransition] = useTransition();
	const [open, setOpen] = useState(false);

	function submit(formData: FormData) {
		startTransition(async () => {
			const ok = await runAction(() => createFactAction(personId, formData), "Couldn't add fact.");
			if (!ok) return;
			formRef.current?.reset();
			setOpen(false);
		});
	}

	return (
		<section className="mt-14" aria-label="Facts">
			<SectionHead title="Facts" aside={facts.length > 0 ? String(facts.length) : undefined} />
			<ul>
				{facts.map((f) => (
					<ListRow
						key={f.id}
						trailing={
							<Button
								type="button"
								variant="danger-soft"
								size="sm"
								aria-label={`Delete fact "${f.fact_value}"`}
								disabled={pending}
								onClick={() =>
									startTransition(async () => {
										await runAction(
											() => deleteFactAction(personId, f.id),
											"Couldn't delete fact.",
										);
									})
								}
							>
								Delete
							</Button>
						}
					>
						<p className={rowTitle()}>{f.fact_value}</p>
						<p className="mt-0.5 font-mono text-meta text-ink-4">
							{factTypeLabel(f.fact_type)}
							{f.date_relevant ? ` · ${f.date_relevant}` : ""}
						</p>
					</ListRow>
				))}
			</ul>
			{open ? (
				<form ref={formRef} action={submit} className="mt-3">
					<Card className="space-y-3" padding="compact">
						<div className="grid grid-cols-2 gap-2">
							<Field label="Type">
								<Select name="fact_type" defaultValue="other">
									{FACT_TYPES.map((f) => (
										<option key={f.value} value={f.value}>
											{f.label}
										</option>
									))}
								</Select>
							</Field>
							<Field label="Date">
								<Input type="date" name="date_relevant" />
							</Field>
						</div>
						<Field label="Value">
							<Input name="fact_value" required />
						</Field>
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
					+ Add fact
				</Button>
			)}
		</section>
	);
}

function InteractionsSection({
	personId,
	interactions,
	tz,
}: {
	personId: string;
	interactions: PersonInteractionRow[];
	tz: string;
}) {
	const formRef = useRef<HTMLFormElement>(null);
	const [pending, startTransition] = useTransition();
	const [open, setOpen] = useState(false);

	function submit(formData: FormData) {
		startTransition(async () => {
			const ok = await runAction(
				() => createInteractionAction(personId, formData),
				"Couldn't add interaction.",
			);
			if (!ok) return;
			formRef.current?.reset();
			setOpen(false);
		});
	}

	return (
		<section className="mt-14" aria-label="Interactions">
			<SectionHead
				title="Interactions"
				aside={interactions.length > 0 ? String(interactions.length) : undefined}
			/>
			<ul>
				{interactions.map((i) => (
					<ListRow
						key={i.id}
						trailing={
							<Button
								type="button"
								variant="danger-soft"
								size="sm"
								aria-label="Delete interaction"
								disabled={pending}
								onClick={() =>
									startTransition(async () => {
										await runAction(
											() => deleteInteractionAction(personId, i.id),
											"Couldn't delete interaction.",
										);
									})
								}
							>
								Delete
							</Button>
						}
					>
						<p className={rowTitle()}>{i.notes ?? interactionTypeLabel(i.interaction_type)}</p>
						<p className="mt-0.5 font-mono text-meta text-ink-4">
							{interactionTypeLabel(i.interaction_type)} · {formatInstant(i.occurred_at, tz)}
						</p>
					</ListRow>
				))}
			</ul>
			{open ? (
				<form ref={formRef} action={submit} className="mt-3">
					<Card className="space-y-3" padding="compact">
						<div className="grid grid-cols-2 gap-2">
							<Field label="Type">
								<Select name="interaction_type" defaultValue="call">
									{INTERACTION_TYPES.map((t) => (
										<option key={t.value} value={t.value}>
											{t.label}
										</option>
									))}
								</Select>
							</Field>
							<div className="grid grid-cols-2 gap-2">
								<Field label="Date">
									<Input type="date" name="occurred_date" />
								</Field>
								<Field label="Time">
									<Input type="time" name="occurred_time" />
								</Field>
							</div>
						</div>
						<Field label="Notes">
							<Textarea name="notes" rows={2} size="sm" />
						</Field>
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
								Log
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
					+ Log interaction
				</Button>
			)}
		</section>
	);
}
