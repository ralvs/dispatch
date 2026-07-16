"use client";

import { useRef, useState, useTransition } from "react";
import { TIME_OF_DAY_LABELS, TIME_OF_DAY_ORDER } from "@/lib/schemas/routine";
import { createRoutineAction } from "./actions";

export function RoutineForm() {
	const formRef = useRef<HTMLFormElement>(null);
	const [open, setOpen] = useState(false);
	const [pending, startTransition] = useTransition();

	function submit(formData: FormData) {
		startTransition(async () => {
			await createRoutineAction(formData);
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
				+ New routine
			</button>
		);
	}

	return (
		<form
			ref={formRef}
			action={submit}
			className="space-y-3 border border-line-strong bg-surface p-4"
		>
			<label className="block">
				<span className="font-mono text-eyebrow uppercase text-ink-3">Name</span>
				<input
					name="name"
					required
					aria-label="Routine name"
					placeholder="Stretch, read, drink water…"
					className="mt-1 w-full border border-line bg-bg px-2 py-1.5 font-serif text-base text-ink placeholder:text-ink-4"
				/>
			</label>
			<label className="block">
				<span className="font-mono text-eyebrow uppercase text-ink-3">Time of day</span>
				<select
					name="time_of_day"
					defaultValue="anytime"
					className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
				>
					{TIME_OF_DAY_ORDER.map((t) => (
						<option key={t} value={t}>
							{TIME_OF_DAY_LABELS[t]}
						</option>
					))}
				</select>
			</label>
			<div className="flex gap-2 pt-1">
				<button
					type="submit"
					disabled={pending}
					className="bg-ink px-4 py-2 font-mono text-eyebrow uppercase tracking-widest text-bg disabled:opacity-50"
				>
					{pending ? "Adding…" : "Add routine"}
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
