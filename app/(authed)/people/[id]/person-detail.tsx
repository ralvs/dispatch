"use client";

import { useRef, useState, useTransition } from "react";
import { runAction } from "@/lib/client/toast";
import { formatInstant } from "@/lib/dates";
import type { PersonFactRow, PersonInteractionRow, PersonRow } from "@/lib/services/people";
import {
	createFactAction,
	createInteractionAction,
	deleteFactAction,
	deleteInteractionAction,
	deletePersonAction,
	updatePersonAction,
} from "./actions";

const RELATIONSHIP_TYPES = [
	{ value: "", label: "Unspecified" },
	{ value: "client", label: "Client" },
	{ value: "family", label: "Family" },
	{ value: "friend", label: "Friend" },
	{ value: "team", label: "Team" },
	{ value: "vendor", label: "Vendor" },
	{ value: "other", label: "Other" },
];

const FACT_TYPES = [
	{ value: "anniversary", label: "Anniversary" },
	{ value: "birthday", label: "Birthday" },
	{ value: "kid_name", label: "Kid's name" },
	{ value: "shared", label: "Shared" },
	{ value: "follow_up", label: "Follow up" },
	{ value: "other", label: "Other" },
];

const INTERACTION_TYPES = [
	{ value: "email", label: "Email" },
	{ value: "call", label: "Call" },
	{ value: "in_person", label: "In person" },
	{ value: "text", label: "Text" },
	{ value: "meeting", label: "Meeting" },
	{ value: "other", label: "Other" },
];

export function PersonDetail({
	person,
	facts,
	interactions,
	tz,
}: {
	person: PersonRow;
	facts: PersonFactRow[];
	interactions: PersonInteractionRow[];
	tz: string;
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
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Person</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">{person.name}</h1>
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
								defaultValue={person.name}
								className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
							/>
						</label>
						<div className="grid grid-cols-2 gap-3">
							<label className="block">
								<span className="font-mono text-eyebrow uppercase text-ink-3">Relationship</span>
								<select
									name="relationship_type"
									defaultValue={person.relationship_type ?? ""}
									className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
								>
									{RELATIONSHIP_TYPES.map((r) => (
										<option key={r.value} value={r.value}>
											{r.label}
										</option>
									))}
								</select>
							</label>
							<label className="block">
								<span className="font-mono text-eyebrow uppercase text-ink-3">Company</span>
								<input
									name="company"
									defaultValue={person.company ?? ""}
									className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
								/>
							</label>
							<label className="block">
								<span className="font-mono text-eyebrow uppercase text-ink-3">Email</span>
								<input
									name="email"
									type="email"
									defaultValue={person.email ?? ""}
									className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
								/>
							</label>
							<label className="block">
								<span className="font-mono text-eyebrow uppercase text-ink-3">Phone</span>
								<input
									name="phone"
									defaultValue={person.phone ?? ""}
									className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
								/>
							</label>
							<label className="col-span-2 block">
								<span className="font-mono text-eyebrow uppercase text-ink-3">Notes</span>
								<textarea
									name="notes"
									rows={3}
									defaultValue={person.notes ?? ""}
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
								<dt className="font-mono text-eyebrow uppercase text-ink-3">Relationship</dt>
								<dd>{person.relationship_type ?? "—"}</dd>
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
							<button
								type="button"
								aria-label={`Edit ${person.name}`}
								onClick={() => setEditing(true)}
								className="rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
							>
								Edit
							</button>
							<button
								type="button"
								aria-label={`Delete ${person.name}`}
								disabled={pending}
								onClick={() =>
									startTransition(async () => {
										await runAction(() => deletePersonAction(person.id), "Couldn't delete person.");
									})
								}
								className="rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-accent-slip hover:border-accent-slip"
							>
								Delete
							</button>
						</div>
					</div>
				)}
			</section>

			<FactsSection personId={person.id} facts={facts} />
			<InteractionsSection personId={person.id} interactions={interactions} tz={tz} />
		</div>
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
		<section className="mt-8" aria-label="Facts">
			<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">Facts</h2>
			<ul className="mt-2">
				{facts.map((f) => (
					<li key={f.id} className="hairline flex items-baseline justify-between gap-3 py-2">
						<div>
							<p className="text-sm text-ink">{f.fact_value}</p>
							<p className="mt-0.5 font-mono text-meta text-ink-4">
								{f.fact_type}
								{f.date_relevant ? ` · ${f.date_relevant}` : ""}
							</p>
						</div>
						<button
							type="button"
							aria-label={`Delete fact "${f.fact_value}"`}
							disabled={pending}
							onClick={() =>
								startTransition(async () => {
									await runAction(() => deleteFactAction(personId, f.id), "Couldn't delete fact.");
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
					<div className="grid grid-cols-2 gap-2">
						<label className="block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Type</span>
							<select
								name="fact_type"
								defaultValue="other"
								className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
							>
								{FACT_TYPES.map((f) => (
									<option key={f.value} value={f.value}>
										{f.label}
									</option>
								))}
							</select>
						</label>
						<label className="block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Date</span>
							<input
								type="date"
								name="date_relevant"
								className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
							/>
						</label>
					</div>
					<label className="block">
						<span className="font-mono text-eyebrow uppercase text-ink-3">Value</span>
						<input
							name="fact_value"
							required
							className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
						/>
					</label>
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
					+ Add fact
				</button>
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
		<section className="mt-8" aria-label="Interactions">
			<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">Interactions</h2>
			<ul className="mt-2">
				{interactions.map((i) => (
					<li key={i.id} className="hairline flex items-baseline justify-between gap-3 py-2">
						<div>
							<p className="text-sm text-ink">{i.notes ?? i.interaction_type}</p>
							<p className="mt-0.5 font-mono text-meta text-ink-4">
								{i.interaction_type} · {formatInstant(i.occurred_at, tz)}
							</p>
						</div>
						<button
							type="button"
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
					<div className="grid grid-cols-2 gap-2">
						<label className="block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Type</span>
							<select
								name="interaction_type"
								defaultValue="call"
								className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
							>
								{INTERACTION_TYPES.map((t) => (
									<option key={t.value} value={t.value}>
										{t.label}
									</option>
								))}
							</select>
						</label>
						<div className="grid grid-cols-2 gap-2">
							<label className="block">
								<span className="font-mono text-eyebrow uppercase text-ink-3">Date</span>
								<input
									type="date"
									name="occurred_date"
									className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
								/>
							</label>
							<label className="block">
								<span className="font-mono text-eyebrow uppercase text-ink-3">Time</span>
								<input
									type="time"
									name="occurred_time"
									className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
								/>
							</label>
						</div>
					</div>
					<label className="block">
						<span className="font-mono text-eyebrow uppercase text-ink-3">Notes</span>
						<textarea
							name="notes"
							rows={2}
							className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
						/>
					</label>
					<div className="flex gap-2">
						<button
							type="submit"
							disabled={pending}
							className="rounded-md bg-ink px-3 py-1.5 font-mono text-eyebrow uppercase tracking-widest text-bg disabled:opacity-50"
						>
							Log
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
					+ Log interaction
				</button>
			)}
		</section>
	);
}
