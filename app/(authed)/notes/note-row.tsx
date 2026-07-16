"use client";

import { useState, useTransition } from "react";
import type { NoteListRow } from "@/lib/services/notes";
import { deleteNoteAction, resolveNeedsReviewAction, updateNoteAction } from "./actions";

export function NoteRowItem({ note }: { note: NoteListRow }) {
	const [pending, startTransition] = useTransition();
	const [editing, setEditing] = useState(false);
	const [title, setTitle] = useState(note.title ?? "");
	const [body, setBody] = useState(note.body);

	function save() {
		const fd = new FormData();
		fd.set("title", title);
		fd.set("body", body);
		fd.set("tags", note.tags.join(", "));
		fd.set("source_type", note.source_type);
		startTransition(async () => {
			await updateNoteAction(note.id, fd);
			setEditing(false);
		});
	}

	if (editing) {
		return (
			<li className={`hairline space-y-2 py-3 ${pending ? "opacity-50" : ""}`}>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Title</span>
					<input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Body</span>
					<textarea
						value={body}
						onChange={(e) => setBody(e.target.value)}
						rows={3}
						aria-label="Edit note body"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
					/>
				</label>
				<div className="flex gap-2">
					<button
						type="button"
						disabled={pending}
						onClick={save}
						className="bg-ink px-3 py-1.5 font-mono text-eyebrow uppercase tracking-widest text-bg disabled:opacity-50"
					>
						Save
					</button>
					<button
						type="button"
						onClick={() => setEditing(false)}
						className="px-3 py-1.5 font-mono text-eyebrow uppercase tracking-widest text-ink-3"
					>
						Cancel
					</button>
				</div>
			</li>
		);
	}

	return (
		<li className={`hairline py-3 ${pending ? "opacity-50" : ""}`}>
			{note.title && <p className="font-serif text-base text-ink">{note.title}</p>}
			<p className="whitespace-pre-wrap text-sm text-ink">{note.body}</p>
			<p className="mt-1 font-mono text-meta text-ink-4">
				{note.source_type}
				{note.tags.length > 0 ? ` · ${note.tags.join(", ")}` : ""}
			</p>
			<div className="mt-2 flex gap-2">
				{note.needs_review && (
					<button
						type="button"
						aria-label={`Resolve needs-review flag on "${note.title ?? note.body.slice(0, 20)}"`}
						disabled={pending}
						onClick={() => startTransition(() => resolveNeedsReviewAction(note.id))}
						className="border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
					>
						Resolve
					</button>
				)}
				<button
					type="button"
					aria-label={`Edit note "${note.title ?? note.body.slice(0, 20)}"`}
					onClick={() => setEditing(true)}
					className="border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
				>
					Edit
				</button>
				<button
					type="button"
					aria-label={`Delete note "${note.title ?? note.body.slice(0, 20)}"`}
					disabled={pending}
					onClick={() => startTransition(() => deleteNoteAction(note.id))}
					className="border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-accent-slip hover:border-accent-slip"
				>
					Delete
				</button>
			</div>
		</li>
	);
}
