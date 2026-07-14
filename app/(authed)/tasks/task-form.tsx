"use client";

import { useRef, useState, useTransition } from "react";
import { RECURRENCE_LABELS, RECURRENCE_PATTERNS } from "@/lib/recurrence";
import { createTaskAction } from "./actions";

type DomainOption = { id: string; name: string; is_system: boolean };

export function TaskForm({ domains }: { domains: DomainOption[] }) {
	const formRef = useRef<HTMLFormElement>(null);
	const [open, setOpen] = useState(false);
	const [pending, startTransition] = useTransition();

	function submit(formData: FormData) {
		startTransition(async () => {
			await createTaskAction(formData);
			formRef.current?.reset();
			setOpen(false);
		});
	}

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="w-full border border-line px-3 py-2.5 text-left font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
			>
				+ New task
			</button>
		);
	}

	return (
		<form
			ref={formRef}
			action={submit}
			className="space-y-3 border border-line-strong bg-surface p-4"
		>
			<input
				name="title"
				required
				placeholder="What needs doing?"
				aria-label="Task title"
				className="w-full border-b border-line bg-transparent pb-2 font-serif text-lg text-ink outline-none placeholder:text-ink-4"
			/>
			<div className="grid grid-cols-2 gap-3">
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Due date</span>
					<input
						type="date"
						name="due_date"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Time</span>
					<input
						type="time"
						name="due_time"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Domain</span>
					<select
						name="domain_id"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
					>
						{domains.map((d) => (
							<option key={d.id} value={d.id}>
								{d.name}
							</option>
						))}
					</select>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Priority</span>
					<select
						name="priority"
						defaultValue="4"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
					>
						<option value="1">P1 — critical</option>
						<option value="2">P2</option>
						<option value="3">P3</option>
						<option value="4">P4 — someday</option>
					</select>
				</label>
				<label className="col-span-2 block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Repeats</span>
					<select
						name="recurrence_rule"
						defaultValue=""
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
					>
						<option value="">Never</option>
						{RECURRENCE_PATTERNS.map((p) => (
							<option key={p} value={p}>
								{RECURRENCE_LABELS[p]}
							</option>
						))}
					</select>
				</label>
			</div>
			<div className="flex gap-2 pt-1">
				<button
					type="submit"
					disabled={pending}
					className="bg-ink px-4 py-2 font-mono text-eyebrow uppercase tracking-widest text-bg disabled:opacity-50"
				>
					{pending ? "Adding…" : "Add task"}
				</button>
				<button
					type="button"
					onClick={() => setOpen(false)}
					className="px-3 py-2 font-mono text-eyebrow uppercase tracking-widest text-ink-3"
				>
					Cancel
				</button>
			</div>
		</form>
	);
}
