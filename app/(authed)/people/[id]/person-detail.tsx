"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
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
import { toastError } from "@/lib/client/toast";
import { formatInstant, instantFromLocal, nowUtc } from "@/lib/dates";
import { displayTitle } from "@/lib/note-display";
import {
	PersonFactTypeSchema,
	PersonInteractionTypeSchema,
	RelationshipTypeSchema,
} from "@/lib/schemas/person";
import type { PersonFactRow, PersonInteractionRow, PersonRow } from "@/lib/services/people";
import {
	isNavigationError,
	useProvisionalIds,
	useRunIntent,
	useStoreWrite,
	useView,
	viewKey,
} from "@/lib/store";
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

/** A text field as the server will store it: blank clears it (lib/form-decode.ts). */
function textField(formData: FormData, key: string): string | null {
	const value = String(formData.get(key) ?? "").trim();
	return value === "" ? null : value;
}

/** What an edit asks for, so the page shows it while the server writes it. */
function personPatch(formData: FormData): Partial<PersonRow> {
	const relationship = RelationshipTypeSchema.safeParse(formData.get("relationship_type"));
	const name = textField(formData, "name");
	return {
		...(name ? { name } : {}),
		relationship_type: relationship.success ? relationship.data : null,
		company: textField(formData, "company"),
		email: textField(formData, "email"),
		phone: textField(formData, "phone"),
		notes: textField(formData, "notes"),
	};
}

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
	const [pending, startTransition] = useTransition();
	const [editing, setEditing] = useState(false);
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
	const write = useStoreWrite("person");

	// Gone, and not by a delete in flight here — deleted in another tab.
	if (!person) {
		return (
			<EmptyState>
				This person is gone. <Link href="/people">Back to People</Link>
			</EmptyState>
		);
	}

	function saveDetails(formData: FormData) {
		startTransition(async () => {
			try {
				const result = await write(
					{ type: "patch", id: personId, patch: personPatch(formData) },
					() => updatePersonAction(personId, formData),
				);
				if (result.ok) setEditing(false);
				else toastError(result.formError ?? "Couldn't save person.");
			} catch (error) {
				// A redirect() (an expired session) navigates on its own; it is not a failure.
				if (!isNavigationError(error)) toastError("Couldn't save person.");
			}
		});
	}

	function remove() {
		setLeaving(true);
		startTransition(async () => {
			try {
				const result = await write({ type: "delete", id: personId }, () =>
					deletePersonAction(personId),
				);
				if (result.ok) {
					router.push("/people");
					return;
				}
				toastError(result.formError ?? "Couldn't delete person.");
			} catch (error) {
				if (!isNavigationError(error)) toastError("Couldn't delete person.");
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
								disabled={pending}
								onClick={() => setEditing(true)}
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

/** The fact the list shows while the server writes it; the server's row replaces it. */
function optimisticFact(personId: string, formData: FormData): PersonFactRow {
	const type = PersonFactTypeSchema.safeParse(formData.get("fact_type"));
	const date = textField(formData, "date_relevant");
	return {
		id: crypto.randomUUID(),
		person_id: personId,
		fact_type: type.success ? type.data : "other",
		fact_value: textField(formData, "fact_value") ?? "",
		source_ref: null,
		date_relevant: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
		recurring: false,
		created_at: nowUtc(),
	};
}

function FactsSection({ personId, facts }: { personId: string; facts: PersonFactRow[] }) {
	const formRef = useRef<HTMLFormElement>(null);
	const [pending, startTransition] = useTransition();
	const [open, setOpen] = useState(false);
	const write = useStoreWrite("personFact");
	const run = useRunIntent("personFact", { errorMessage: "Couldn't delete fact." });
	// A fact still being saved has the client's id: no delete until it is real.
	const saving = useProvisionalIds("personFact");

	function submit(formData: FormData) {
		startTransition(async () => {
			try {
				const result = await write(
					{ type: "create", row: optimisticFact(personId, formData) },
					() => createFactAction(personId, formData),
				);
				if (!result.ok) {
					toastError(result.formError ?? "Couldn't add fact.");
					return;
				}
				formRef.current?.reset();
				setOpen(false);
			} catch (error) {
				if (!isNavigationError(error)) toastError("Couldn't add fact.");
			}
		});
	}

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
								onClick={() =>
									run({ type: "delete", id: f.id }, () => deleteFactAction(personId, f.id))
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

/**
 * The interaction the list shows while the server writes it. Its time follows
 * the server's rule: the entered day and time in the app timezone, else now.
 */
function optimisticInteraction(
	personId: string,
	formData: FormData,
	tz: string,
): PersonInteractionRow {
	const type = PersonInteractionTypeSchema.safeParse(formData.get("interaction_type"));
	const date = textField(formData, "occurred_date");
	const time = textField(formData, "occurred_time") ?? "00:00";
	let occurredAt = nowUtc();
	if (date) {
		try {
			occurredAt = instantFromLocal(date, time, tz);
		} catch {
			// An unparseable entry: the server rejects it and the row rolls back.
		}
	}
	return {
		id: crypto.randomUUID(),
		person_id: personId,
		interaction_type: type.success ? type.data : "other",
		notes: textField(formData, "notes"),
		occurred_at: occurredAt,
	};
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
	const write = useStoreWrite("personInteraction");
	const run = useRunIntent("personInteraction", { errorMessage: "Couldn't delete interaction." });
	const saving = useProvisionalIds("personInteraction");

	function submit(formData: FormData) {
		startTransition(async () => {
			try {
				const result = await write(
					{ type: "create", row: optimisticInteraction(personId, formData, tz) },
					() => createInteractionAction(personId, formData),
				);
				if (!result.ok) {
					toastError(result.formError ?? "Couldn't add interaction.");
					return;
				}
				formRef.current?.reset();
				setOpen(false);
			} catch (error) {
				if (!isNavigationError(error)) toastError("Couldn't add interaction.");
			}
		});
	}

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
								onClick={() =>
									run({ type: "delete", id: i.id }, () => deleteInteractionAction(personId, i.id))
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
