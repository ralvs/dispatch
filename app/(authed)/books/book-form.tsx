"use client";

import { useRef, useState, useTransition } from "react";
import { BookFormatSchema } from "@/lib/schemas/book";
import { createBookAction } from "./actions";

const FORMATS = BookFormatSchema.options;

export function BookForm() {
	const formRef = useRef<HTMLFormElement>(null);
	const [open, setOpen] = useState(false);
	const [pending, startTransition] = useTransition();

	function submit(formData: FormData) {
		startTransition(async () => {
			await createBookAction(formData);
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
				+ New book
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
				<span className="font-mono text-eyebrow uppercase text-ink-3">Title</span>
				<input
					name="title"
					required
					aria-label="Title"
					className="mt-1 w-full border border-line bg-bg px-2 py-1.5 font-serif text-base text-ink"
				/>
			</label>
			<div className="grid grid-cols-2 gap-3">
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Author</span>
					<input
						name="author"
						placeholder="Optional"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Format</span>
					<select
						name="format"
						defaultValue=""
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
					>
						<option value="">Unspecified</option>
						{FORMATS.map((f) => (
							<option key={f} value={f}>
								{f}
							</option>
						))}
					</select>
				</label>
				<label className="col-span-2 block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">ISBN</span>
					<input
						name="isbn"
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
					{pending ? "Adding…" : "Add book"}
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
