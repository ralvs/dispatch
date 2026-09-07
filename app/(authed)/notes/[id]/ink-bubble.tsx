"use client";

import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { INK_SLUG_LABELS, INK_SLUGS, type InkSlug, inkVar } from "@/lib/ink";

export function InkBubble({ editor }: { editor: Editor }) {
	return (
		<BubbleMenu
			editor={editor}
			options={{ placement: "top", offset: 8 }}
			shouldShow={({ editor: ed, state }) => {
				if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
					return false;
				}
				const { from, to } = state.selection;
				return ed.isEditable && from !== to;
			}}
		>
			<div
				role="toolbar"
				aria-label="Text colour"
				className="flex max-w-[18rem] flex-wrap items-center gap-0.5 rounded-card border border-line-strong bg-surface p-1 elevation-overlay"
			>
				{INK_SLUGS.map((slug) => (
					<InkDot
						key={slug}
						slug={slug}
						active={editor.isActive("ink", { slug })}
						onPick={() => editor.chain().focus().setMark("ink", { slug }).run()}
					/>
				))}
				<button
					type="button"
					aria-label="Clear colour"
					title="Clear"
					onClick={() => editor.chain().focus().unsetMark("ink").run()}
					className="flex size-7 items-center justify-center rounded-pill border border-line font-mono text-meta text-ink-4 hover:border-line-strong hover:text-ink"
				>
					×
				</button>
			</div>
		</BubbleMenu>
	);
}

function InkDot({ slug, active, onPick }: { slug: InkSlug; active: boolean; onPick: () => void }) {
	return (
		<button
			type="button"
			aria-label={INK_SLUG_LABELS[slug]}
			aria-pressed={active}
			title={INK_SLUG_LABELS[slug]}
			onClick={onPick}
			className="flex size-7 items-center justify-center"
		>
			<span
				aria-hidden="true"
				style={{ backgroundColor: inkVar(slug) }}
				className={`block size-4 rounded-full ring-2 ring-offset-2 ring-offset-surface ${
					active ? "ring-ink" : "ring-transparent"
				}`}
			/>
		</button>
	);
}
