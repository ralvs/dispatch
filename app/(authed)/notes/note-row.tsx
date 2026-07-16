"use client";

import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState, useTransition } from "react";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";
import { createDebouncedSave } from "@/lib/debounced-save";
import type { NoteListRow } from "@/lib/services/notes";
import { deleteNoteAction, resolveNeedsReviewAction, updateNoteAction } from "./actions";

function getMarkdown(editor: Editor): string {
	const storage = editor.storage as unknown as { markdown: MarkdownStorage };
	return storage.markdown.getMarkdown();
}

type SaveState = "idle" | "saving" | "saved";

export function NoteRowItem({ note }: { note: NoteListRow }) {
	const [pending, startTransition] = useTransition();
	const [saveState, setSaveState] = useState<SaveState>("idle");
	const bodyRef = useRef(note.body);
	const savedIndicatorTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

	function save(body: string) {
		if (body === bodyRef.current) return;
		bodyRef.current = body;
		const fd = new FormData();
		fd.set("title", note.title ?? "");
		fd.set("body", body);
		fd.set("tags", note.tags.join(", "));
		fd.set("source_type", note.source_type);
		setSaveState("saving");
		startTransition(async () => {
			await updateNoteAction(note.id, fd);
			setSaveState("saved");
			clearTimeout(savedIndicatorTimer.current);
			savedIndicatorTimer.current = setTimeout(() => setSaveState("idle"), 1500);
		});
	}

	const debouncedRef = useRef(createDebouncedSave(save));

	useEffect(() => {
		return () => {
			clearTimeout(savedIndicatorTimer.current);
			debouncedRef.current.cancel();
		};
	}, []);

	const editor = useEditor({
		immediatelyRender: false,
		extensions: [StarterKit, Markdown.configure({ html: false })],
		content: note.body,
		editorProps: {
			attributes: {
				"aria-label": "Note body",
				class: "whitespace-pre-wrap text-sm text-ink outline-none",
			},
		},
		onUpdate: ({ editor }) => {
			debouncedRef.current.schedule(getMarkdown(editor));
		},
		onBlur: () => {
			debouncedRef.current.flush();
		},
	});

	return (
		<li className={`hairline py-3 ${pending ? "opacity-50" : ""}`}>
			{note.title && <p className="font-serif text-base text-ink">{note.title}</p>}
			<EditorContent editor={editor} />
			<p className="mt-1 font-mono text-meta text-ink-4">
				{note.source_type}
				{note.tags.length > 0 ? ` · ${note.tags.join(", ")}` : ""}
				{saveState === "saving" ? " · Saving…" : ""}
				{saveState === "saved" ? " · Saved" : ""}
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
