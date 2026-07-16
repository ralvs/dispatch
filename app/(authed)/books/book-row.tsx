"use client";

import { useState, useTransition } from "react";
import type { BookRow as BookRowType } from "@/lib/services/books";
import {
	abandonBookAction,
	deleteBookAction,
	finishBookAction,
	markWantToReadAction,
	startReadingBookAction,
	updateBookAction,
} from "./actions";

const STATUS_LABEL: Record<BookRowType["status"], string> = {
	want_to_read: "Want to read",
	reading: "Reading",
	finished: "Finished",
	abandoned: "Abandoned",
};

export function BookRowItem({ book }: { book: BookRowType }) {
	const [pending, startTransition] = useTransition();
	const [editing, setEditing] = useState(false);
	const [finishing, setFinishing] = useState(false);

	return (
		<li className={`hairline py-3 ${pending ? "opacity-50" : ""}`}>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="font-serif text-base text-ink">{book.title}</p>
					<p className="mt-0.5 font-mono text-meta text-ink-4">
						{book.author ?? "Unknown author"}
						{book.format ? ` · ${book.format}` : ""}
						{book.status === "reading" && book.started_at ? ` · started ${book.started_at}` : ""}
						{book.status === "finished" && book.finished_at
							? ` · finished ${book.finished_at}`
							: ""}
						{book.status === "finished" && book.rating ? ` · ${book.rating}/5` : ""}
					</p>
					{book.status === "finished" && book.my_summary ? (
						<p className="mt-1 font-serif text-sm text-ink-2">{book.my_summary}</p>
					) : null}
				</div>
				<span className="shrink-0 font-mono text-meta uppercase tracking-widest text-ink-4">
					{STATUS_LABEL[book.status]}
				</span>
			</div>

			<div className="mt-2 flex flex-wrap gap-2">
				{book.status === "want_to_read" && (
					<button
						type="button"
						disabled={pending}
						onClick={() => startTransition(() => startReadingBookAction(book.id))}
						className="border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
					>
						Start reading
					</button>
				)}
				{book.status === "reading" && (
					<>
						<button
							type="button"
							aria-expanded={finishing}
							onClick={() => setFinishing((f) => !f)}
							className="border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
						>
							{finishing ? "Cancel finish" : "Finish"}
						</button>
						<button
							type="button"
							disabled={pending}
							onClick={() => startTransition(() => abandonBookAction(book.id))}
							className="border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
						>
							Abandon
						</button>
					</>
				)}
				{book.status === "abandoned" && (
					<button
						type="button"
						disabled={pending}
						onClick={() => startTransition(() => markWantToReadAction(book.id))}
						className="border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
					>
						Want to read
					</button>
				)}
				<button
					type="button"
					aria-expanded={editing}
					onClick={() => setEditing((e) => !e)}
					className="border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
				>
					{editing ? "Cancel edit" : "Edit"}
				</button>
				<button
					type="button"
					aria-label={`Delete "${book.title}"`}
					disabled={pending}
					onClick={() => startTransition(() => deleteBookAction(book.id))}
					className="border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-accent-slip hover:border-accent-slip"
				>
					Delete
				</button>
			</div>

			{finishing && (
				<form
					action={(formData) =>
						startTransition(async () => {
							await finishBookAction(book.id, formData);
							setFinishing(false);
						})
					}
					className="mt-3 space-y-2 border border-line-strong bg-surface p-3"
				>
					<div className="grid grid-cols-2 gap-3">
						<label className="block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Rating (1-5)</span>
							<input
								type="number"
								name="rating"
								min={1}
								max={5}
								aria-label="Rating"
								className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
							/>
						</label>
						<label className="col-span-2 block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Summary</span>
							<textarea
								name="my_summary"
								rows={2}
								aria-label="Closing summary"
								placeholder="Optional"
								className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
							/>
						</label>
					</div>
					<button
						type="submit"
						disabled={pending}
						className="bg-ink px-4 py-2 font-mono text-eyebrow uppercase tracking-widest text-bg disabled:opacity-50"
					>
						{pending ? "Saving…" : "Mark finished"}
					</button>
				</form>
			)}

			{editing && (
				<form
					action={(formData) =>
						startTransition(async () => {
							await updateBookAction(book.id, formData);
							setEditing(false);
						})
					}
					className="mt-3 space-y-2 border border-line-strong bg-surface p-3"
				>
					<div className="grid grid-cols-2 gap-3">
						<label className="block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Title</span>
							<input
								name="title"
								defaultValue={book.title}
								required
								aria-label="Title"
								className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
							/>
						</label>
						<label className="block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Author</span>
							<input
								name="author"
								defaultValue={book.author ?? ""}
								aria-label="Author"
								className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
							/>
						</label>
						<label className="block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">ISBN</span>
							<input
								name="isbn"
								defaultValue={book.isbn ?? ""}
								aria-label="ISBN"
								className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
							/>
						</label>
						<label className="block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Format</span>
							<select
								name="format"
								defaultValue={book.format ?? ""}
								className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
							>
								<option value="">Unspecified</option>
								<option value="physical">physical</option>
								<option value="kindle">kindle</option>
								<option value="audiobook">audiobook</option>
							</select>
						</label>
						<label className="col-span-2 block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Summary</span>
							<textarea
								name="my_summary"
								defaultValue={book.my_summary ?? ""}
								rows={2}
								aria-label="Summary"
								className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
							/>
						</label>
					</div>
					<button
						type="submit"
						disabled={pending}
						className="bg-ink px-4 py-2 font-mono text-eyebrow uppercase tracking-widest text-bg disabled:opacity-50"
					>
						{pending ? "Saving…" : "Save changes"}
					</button>
				</form>
			)}
		</li>
	);
}
