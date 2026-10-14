"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
	Button,
	Card,
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
import { formatInstant } from "@/lib/dates";
import { displayTitle } from "@/lib/note-display";
import type { PersonFactRow, PersonInteractionRow } from "@/lib/services/people";
import { useInlineEdit, useProvisionalIds, useView, useWrites, viewKey } from "@/lib/store";
import {
	FACT_TYPES,
	factTypeLabel,
	INTERACTION_TYPES,
	interactionTypeLabel,
	RELATIONSHIP_TYPES,
	relationshipLabel,
} from "../constants";
import { personFactWrites, personInteractionWrites, personWrites } from "./writes";

const NO_FACTS: PersonFactRow[] = [];
const NO_INTERACTIONS: PersonInteractionRow[] = [];

/**
 * The person, their facts and their interactions come from the entity store
 * views the page's <Seed> fed (#30), so every edit shows at once and a rename
 * reaches /people too. Mentions are derived on the server (ADR-0030) and stay
 * props.
 */
export function PersonDetail({
	personId,
	tz,
	mentionedTasks,
	mentionedNotes,
}: {
	personId: string;
	tz: string;
	/** Tasks whose title/notes mention this person (docs/adr/0030 §5). */
	mentionedTasks: { id: string; title: string; status: string }[];
	/** Notes whose body mentions this person. */
	mentionedNotes: { id: string; title: string | null; body: string }[];
}) {
	const router = useRouter();
	const [removing, startTransition] = useTransition();
	const edit = useInlineEdit();
	const { save } = useWrites();
	const pending = edit.pending || removing;
	// Set from the delete click until this page unmounts, unless it fails.
	const [leaving, setLeaving] = useState(false);
	// Next keeps a left page mounted but hidden, and hiding runs effect
	// cleanups: reset here, so going Back to a deleted person shows them gone
	// rather than held.
	useEffect(() => () => setLeaving(false), []);
	const stored = useView(viewKey.person(personId))?.[0];
	// The last person the store held: a delete leaves the view at once, and the
	// page keeps showing it — dimmed and inert — until the router has left.
	const [last, setLast] = useState(stored);
	if (stored !== undefined && stored !== last) setLast(stored);
	const person = stored ?? (leaving ? last : undefined);
	const facts = useView(viewKey.personFacts(personId)) ?? NO_FACTS;
	const interactions = useView(viewKey.personInteractions(personId)) ?? NO_INTERACTIONS;

	// Gone, and not by a delete in flight here — deleted in another tab.
	if (!person) {
		return (
			<EmptyState>
				This person is gone. <Link href="/people">Back to People</Link>
			</EmptyState>
		);
	}

	function remove() {
		setLeaving(true);
		startTransition(async () => {
			if (await save(personWrites.remove(personId))) {
				router.push("/people");
				return;
			}
			setLeaving(false);
		});
	}

	return (
		<div className={pending || leaving ? "opacity-50" : ""} inert={leaving}>
			{/* Name is the title; relationship + company are facts (plain),
			    fact count is the measure (Pass 4.5 Gate A). */}
			<PageHeader
				title={person.name}
				facts={[
					...(person.relationship_type ? [relationshipLabel(person.relationship_type)] : []),
					...(person.company ? [person.company] : []),
				]}
				measure={[{ count: facts.length, label: facts.length === 1 ? "fact" : "facts" }]}
			/>

			<section aria-label="Details">
				{edit.editing ? (
					<form action={(formData) => edit.submit(personWrites.update(personId, formData))}>
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
								<Button type="button" variant="ghost" onClick={edit.close}>
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
								disabled={pending}
								onClick={edit.open}
							>
								Edit
							</Button>
							<Button
								type="button"
								variant="danger"
								size="sm"
								aria-label={`Delete ${person.name}`}
								disabled={pending || leaving}
								onClick={remove}
							>
								Delete
							</Button>
						</div>
					</div>
				)}
			</section>

			<MentionedInSection tasks={mentionedTasks} notes={mentionedNotes} />
			<FactsSection personId={personId} facts={facts} />
			<InteractionsSection personId={personId} interactions={interactions} tz={tz} />
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
		<section className="mt-9" aria-label="Mentioned in">
			<SectionHead title="Mentioned in" aside={String(tasks.length + notes.length)} />
			<ul>
				{tasks.map((task) => (
					<ListRow key={`task-${task.id}`}>
						<Link
							href={`/tasks/${task.id}`}
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
	const form = useInlineEdit();
	const { send } = useWrites();
	// A fact still being saved has the client's id: no delete until it is real.
	const saving = useProvisionalIds("personFact");

	return (
		<section className="mt-9" aria-label="Facts">
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
								disabled={saving.has(f.id)}
								onClick={() => send(personFactWrites.remove(personId, f.id))}
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
			{form.editing ? (
				<form
					action={(formData) => form.submit(personFactWrites.create(personId, formData))}
					className="mt-3"
				>
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
							<Button type="button" variant="ghost" size="sm" onClick={form.close}>
								Cancel
							</Button>
							<Button
								type="submit"
								variant="primary"
								size="sm"
								isPending={form.pending}
								disabled={form.pending}
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
					onClick={form.open}
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
	const form = useInlineEdit();
	const { send } = useWrites();
	const saving = useProvisionalIds("personInteraction");

	return (
		<section className="mt-9" aria-label="Interactions">
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
								disabled={saving.has(i.id)}
								onClick={() => send(personInteractionWrites.remove(personId, i.id))}
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
			{form.editing ? (
				<form
					action={(formData) => form.submit(personInteractionWrites.create(personId, formData, tz))}
					className="mt-3"
				>
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
							<Button type="button" variant="ghost" size="sm" onClick={form.close}>
								Cancel
							</Button>
							<Button
								type="submit"
								variant="primary"
								size="sm"
								isPending={form.pending}
								disabled={form.pending}
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
					onClick={form.open}
				>
					+ Log interaction
				</Button>
			)}
		</section>
	);
}
