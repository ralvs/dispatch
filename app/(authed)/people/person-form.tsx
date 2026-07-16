"use client";

import { useRef, useState, useTransition } from "react";
import { createPersonAction } from "./actions";

const RELATIONSHIP_TYPES = [
	{ value: "", label: "Unspecified" },
	{ value: "client", label: "Client" },
	{ value: "family", label: "Family" },
	{ value: "church", label: "Church" },
	{ value: "friend", label: "Friend" },
	{ value: "team", label: "Team" },
	{ value: "vendor", label: "Vendor" },
	{ value: "other", label: "Other" },
];

export function PersonForm() {
	const formRef = useRef<HTMLFormElement>(null);
	const [open, setOpen] = useState(false);
	const [pending, startTransition] = useTransition();

	function submit(formData: FormData) {
		startTransition(async () => {
			await createPersonAction(formData);
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
				+ New person
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
				placeholder="Name"
				aria-label="Person name"
				className="w-full border-b border-line bg-transparent pb-2 font-serif text-lg text-ink outline-none placeholder:text-ink-4"
			/>
			<div className="grid grid-cols-2 gap-3">
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Relationship</span>
					<select
						name="relationship_type"
						defaultValue=""
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
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
						placeholder="Optional"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Email</span>
					<input
						name="email"
						type="email"
						placeholder="Optional"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Phone</span>
					<input
						name="phone"
						placeholder="Optional"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
			</div>
			<div className="flex gap-2 pt-1">
				<button
					type="submit"
					disabled={pending}
					className="bg-ink px-4 py-2 font-mono text-eyebrow uppercase tracking-widest text-bg disabled:opacity-50"
				>
					{pending ? "Adding…" : "Add person"}
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
