"use client";

import { useRef, useState, useTransition } from "react";
import { createDomainAction } from "./actions";

export function DomainForm() {
	const formRef = useRef<HTMLFormElement>(null);
	const [open, setOpen] = useState(false);
	const [pending, startTransition] = useTransition();

	function submit(formData: FormData) {
		startTransition(async () => {
			await createDomainAction(formData);
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
				+ New domain
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
				name="name"
				required
				placeholder="Domain name"
				aria-label="Domain name"
				className="w-full border-b border-line bg-transparent pb-2 font-serif text-lg text-ink outline-none placeholder:text-ink-4"
			/>
			<label className="block">
				<span className="font-mono text-eyebrow uppercase text-ink-3">Description</span>
				<textarea
					name="description"
					rows={2}
					placeholder="Optional"
					className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
				/>
			</label>
			<label className="block">
				<span className="font-mono text-eyebrow uppercase text-ink-3">Fruit definition</span>
				<textarea
					name="fruit_definition"
					rows={2}
					placeholder="What does healthy look like here?"
					className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
				/>
			</label>
			<label className="block">
				<span className="font-mono text-eyebrow uppercase text-ink-3">Expected cadence</span>
				<input
					name="expected_cadence"
					placeholder="Optional"
					className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
				/>
			</label>
			<div className="flex gap-2 pt-1">
				<button
					type="submit"
					disabled={pending}
					className="bg-ink px-4 py-2 font-mono text-eyebrow uppercase tracking-widest text-bg disabled:opacity-50"
				>
					{pending ? "Adding…" : "Add domain"}
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
