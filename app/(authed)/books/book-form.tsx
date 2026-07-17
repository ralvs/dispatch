"use client";

import { CollapsibleForm, useCollapsibleForm } from "@/components/collapsible-form";
import { BookFormatSchema } from "@/lib/schemas/book";
import { createBookAction } from "./actions";

const FORMATS = BookFormatSchema.options;

export function BookForm() {
	const form = useCollapsibleForm(createBookAction);

	return (
		<CollapsibleForm
			form={form}
			triggerLabel="+ New book"
			submitLabel="Add book"
			pendingLabel="Adding…"
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
		</CollapsibleForm>
	);
}
