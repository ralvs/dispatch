"use client";

import Paragraph from "@tiptap/extension-paragraph";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import type { Node as PMNode } from "@tiptap/pm/model";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState, useTransition } from "react";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";
import { createDebouncedSave } from "@/lib/debounced-save";
import type { NoteListRow } from "@/lib/services/notes";
import { deleteNoteAction, resolveNeedsReviewAction, saveNoteAction } from "../actions";

// Markdown has no syntax for an empty paragraph, so blank lines between blocks
// were dropped on save — and two different lists left adjacent in the stored
// markdown re-parse as one merged list, spawning a stray task item. Serialize
// empty paragraphs as `&nbsp;` (GFM renders it as a blank line) and parse them
// back to truly empty paragraphs on load.
type MarkdownState = {
	write(text: string): void;
	renderInline(node: PMNode): void;
	closeBlock(node: PMNode): void;
};

const ParagraphKeepBlank = Paragraph.extend({
	addStorage() {
		return {
			markdown: {
				serialize(state: MarkdownState, node: PMNode) {
					if (node.childCount === 0) {
						state.write("&nbsp;");
					} else {
						state.renderInline(node);
					}
					state.closeBlock(node);
				},
				parse: {
					updateDOM(element: HTMLElement) {
						for (const p of element.querySelectorAll("p")) {
							if (p.textContent === "\u00a0") p.textContent = "";
						}
					},
				},
			},
		};
	},
});

function getMarkdown(editor: Editor): string {
	const storage = editor.storage as unknown as { markdown: MarkdownStorage };
	return storage.markdown.getMarkdown();
}

type SaveState = "idle" | "saving" | "saved";

// Full-page live-markdown editor (docs/adr/0009 + 0012): title and body are
// always editable, markdown shortcuts format as you type, and saving is
// autosave — debounced 2s, flushed on blur/unmount. The stored body stays
// plain markdown text, verbatim (iron rule #5).
export function NoteEditor({ note }: { note: NoteListRow }) {
	const [pending, startTransition] = useTransition();
	const [saveState, setSaveState] = useState<SaveState>("idle");
	const titleRef = useRef(note.title ?? "");
	const bodyRef = useRef(note.body);
	const lastSavedRef = useRef(`${note.title ?? ""}\u0000${note.body}`);
	const savedIndicatorTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const mountedRef = useRef(true);

	function save() {
		const title = titleRef.current;
		const body = bodyRef.current;
		const key = `${title}\u0000${body}`;
		if (key === lastSavedRef.current) return;
		lastSavedRef.current = key;
		if (mountedRef.current) setSaveState("saving");
		startTransition(async () => {
			await saveNoteAction(note.id, { title: title.trim() === "" ? null : title, body });
			if (!mountedRef.current) return;
			setSaveState("saved");
			clearTimeout(savedIndicatorTimer.current);
			savedIndicatorTimer.current = setTimeout(() => setSaveState("idle"), 1500);
		});
	}

	const debouncedRef = useRef(createDebouncedSave(save));

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			clearTimeout(savedIndicatorTimer.current);
			// Flush, don't cancel: TipTap's destroy doesn't guarantee a blur,
			// so a pending edit inside the 2s window must not be dropped.
			debouncedRef.current.flush();
		};
	}, []);

	const editor = useEditor({
		immediatelyRender: false,
		autofocus: note.body === "" ? "start" : false,
		extensions: [
			StarterKit.configure({ paragraph: false }),
			ParagraphKeepBlank,
			TaskList,
			TaskItem.configure({ nested: true }),
			Markdown.configure({ html: false }),
		],
		content: note.body,
		editorProps: {
			attributes: {
				"aria-label": "Note body",
				class: "min-h-64 whitespace-pre-wrap text-sm text-ink outline-none",
			},
		},
		onUpdate: ({ editor }) => {
			bodyRef.current = getMarkdown(editor);
			debouncedRef.current.schedule(bodyRef.current);
		},
		onBlur: () => {
			debouncedRef.current.flush();
		},
	});

	return (
		<article>
			<input
				aria-label="Note title"
				defaultValue={note.title ?? ""}
				placeholder="Untitled"
				onChange={(e) => {
					titleRef.current = e.target.value;
					debouncedRef.current.schedule(e.target.value);
				}}
				onBlur={() => debouncedRef.current.flush()}
				className="w-full border-b border-line bg-transparent pb-2 font-serif text-2xl text-ink outline-none placeholder:text-ink-4"
			/>
			{/* Preflight strips heading/list styling; restore just enough for the
			    markdown to read as formatted, matching the app's serif headings. */}
			<div className="mt-4 [&_a]:cursor-pointer [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-ink [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-ink-2 [&_code]:font-mono [&_code]:text-[0.85em] [&_h1]:font-serif [&_h1]:text-2xl [&_h1]:text-ink [&_h2]:font-serif [&_h2]:text-xl [&_h2]:text-ink [&_h3]:font-serif [&_h3]:text-lg [&_h3]:text-ink [&_hr]:my-3 [&_hr]:border-line [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0 [&_ul[data-type=taskList]_ul[data-type=taskList]]:pl-5 [&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:items-baseline [&_ul[data-type=taskList]_li]:gap-2 [&_ul[data-type=taskList]_li>div]:flex-1 [&_ul[data-type=taskList]_input]:accent-accent">
				<EditorContent editor={editor} />
			</div>
			<p className="mt-3 font-mono text-meta text-ink-4">
				{note.source_type}
				{note.tags.length > 0 ? ` · ${note.tags.join(", ")}` : ""}
				{saveState === "saving" ? " · Saving…" : ""}
				{saveState === "saved" ? " · Saved" : ""}
			</p>
			<div className="mt-4 flex gap-2">
				{note.needs_review && (
					<button
						type="button"
						aria-label="Resolve needs-review flag"
						disabled={pending}
						onClick={() => startTransition(() => resolveNeedsReviewAction(note.id))}
						className="rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
					>
						Resolve
					</button>
				)}
				<button
					type="button"
					aria-label="Delete note"
					disabled={pending}
					onClick={() => startTransition(() => deleteNoteAction(note.id))}
					className="rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-accent-slip hover:border-accent-slip"
				>
					Delete
				</button>
			</div>
		</article>
	);
}
