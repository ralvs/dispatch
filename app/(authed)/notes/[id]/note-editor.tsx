"use client";

import Paragraph from "@tiptap/extension-paragraph";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import type { Node as PMNode } from "@tiptap/pm/model";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";
import { Button, type ScopeOption, ScopeSelect } from "@/components/ui";
import { runAction } from "@/lib/client/toast";
import { createDebouncedSave } from "@/lib/debounced-save";
import type { MentionCandidate } from "@/lib/mentions";
import type { NoteListRow } from "@/lib/services/notes";
import {
	deleteNoteAction,
	resolveNeedsReviewAction,
	saveNoteAction,
	setNoteDomainAction,
} from "../actions";
import { InkBubble } from "./ink-bubble";
import { Ink } from "./ink-mark";
import { Mention } from "./mention-extension";
import { createMentionSuggestionExtension } from "./mention-suggestion";
import { TickRail } from "./tick-rail";
import { Wikilink } from "./wikilink-extension";
import { createWikilinkSuggestionExtension, type WikilinkCandidate } from "./wikilink-suggestion";

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
//
// Visual: Pass 3 / W2. Title is Title-step (text-t30). Body is `.prose-authored`
// on the closed ramp inside `.measure-prose`. Autosave layer untouched.
export function NoteEditor({
	note,
	noteTitles,
	people = [],
	domains,
}: {
	note: NoteListRow;
	noteTitles: WikilinkCandidate[];
	/** @mention candidates (docs/adr/0030) for the `@` autocomplete. */
	people?: MentionCandidate[];
	/** Active domains for the filing picker. A note's domain is optional. */
	domains: ScopeOption[];
}) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	// Optimistic so the meta line settles before the RSC round-trip; filing is
	// a one-click move and a select that snaps back reads as a failure.
	const [domainId, setDomainId] = useState(note.domain_id ?? "");
	const [saveState, setSaveState] = useState<SaveState>("idle");
	const titleRef = useRef(note.title ?? "");
	const titleInputRef = useRef<HTMLInputElement>(null);
	const articleRef = useRef<HTMLElement>(null);
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
			const ok = await runAction(
				() => saveNoteAction(note.id, { title: title.trim() === "" ? null : title, body }),
				"Couldn't save note.",
			);
			if (!mountedRef.current) return;
			if (!ok) {
				// Allow retry of the same content.
				lastSavedRef.current = "";
				setSaveState("idle");
				return;
			}
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
			Wikilink,
			createWikilinkSuggestionExtension(noteTitles, note.id),
			Mention,
			createMentionSuggestionExtension(people),
			Ink,
			// html: true so the allowlisted <span data-ink> round-trips
			// (docs/adr/0009 amendment). The schema only accepts that span.
			Markdown.configure({ html: true }),
		],
		content: note.body,
		editorProps: {
			attributes: {
				"aria-label": "Note body",
				class: "min-h-64 whitespace-pre-wrap outline-none",
			},
			handleClickOn: (_view, _pos, node) => {
				if (node.type.name === "wikilink") {
					router.push(`/notes/${node.attrs.id}`);
					return true;
				}
				if (node.type.name === "mention") {
					router.push(`/people/${node.attrs.id}`);
					return true;
				}
				return false;
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
		<article ref={articleRef} className="relative measure-prose">
			{editor ? <InkBubble editor={editor} /> : null}
			<input
				ref={titleInputRef}
				aria-label="Note title"
				defaultValue={note.title ?? ""}
				placeholder="Untitled"
				onChange={(e) => {
					titleRef.current = e.target.value;
					debouncedRef.current.schedule(e.target.value);
				}}
				onBlur={() => debouncedRef.current.flush()}
				className="field-shell h-auto w-full py-1 text-t30 text-ink placeholder:text-ink-4"
			/>
			{/* Authored markdown on the closed ramp — DESIGN.md Prose Measure +
			    Authored prose rules. No serif; no off-ramp 24/20 sizes. */}
			<div className="prose-authored field-shell mt-7 pb-2">
				<EditorContent editor={editor} />
			</div>
			<p className="mt-3 flex flex-wrap items-center gap-x-1.5 font-mono text-meta text-ink-4">
				<span>{note.source_type}</span>
				<span aria-hidden>·</span>
				<ScopeSelect
					value={domainId}
					onChange={(next) => {
						setDomainId(next);
						startTransition(async () => {
							await runAction(() => setNoteDomainAction(note.id, next), "Couldn't file this note.");
						});
					}}
					label="Domain"
					allLabel="No domain"
					options={domains}
				/>
				{note.tags.length > 0 ? <span>· {note.tags.join(", ")}</span> : null}
				{/* Autosave status only — kept out of the static text above so the
				    live region doesn't re-announce the source/tags on every save. */}
				<span aria-live="polite">
					{saveState === "saving" ? " · Saving…" : ""}
					{saveState === "saved" ? " · Saved" : ""}
				</span>
			</p>
			<div className="mt-4 flex gap-2">
				{note.needs_review && (
					<Button
						type="button"
						variant="tertiary"
						size="sm"
						aria-label="Resolve needs-review flag"
						disabled={pending}
						isPending={pending}
						onClick={() =>
							startTransition(async () => {
								await runAction(
									() => resolveNeedsReviewAction(note.id),
									"Couldn't resolve review flag.",
								);
							})
						}
					>
						Resolve
					</Button>
				)}
				<Button
					type="button"
					variant="danger"
					size="sm"
					aria-label="Delete note"
					disabled={pending}
					isPending={pending}
					onClick={() =>
						startTransition(async () => {
							await runAction(() => deleteNoteAction(note.id), "Couldn't delete note.");
						})
					}
				>
					Delete
				</Button>
			</div>
			{/* Last in the DOM on purpose: the rail is fixed, so its position does
			    not depend on order, but tab order does — the note comes first. */}
			{editor ? (
				<TickRail editor={editor} titleRef={titleInputRef} articleRef={articleRef} />
			) : null}
		</article>
	);
}
