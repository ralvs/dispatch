import { Extension } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";
import TaskList from "@tiptap/extension-task-list";
import Text from "@tiptap/extension-text";
import type { Node as PMNode } from "@tiptap/pm/model";

// tiptap-markdown overrides that keep the stored body as close as possible to
// what was written (iron rule #5). Each one fixes a change the editor used to
// make to a note just by opening and saving it.

type MarkdownState = {
	write(text: string): void;
	text(text: string): void;
	// prosemirror-markdown's own flag for "escape line-start syntax here".
	atBlockStart: boolean;
	renderInline(node: PMNode): void;
	closeBlock(node: PMNode): void;
};

// Markdown has no syntax for an empty paragraph, so blank lines between blocks
// were dropped on save — and two different lists left adjacent in the stored
// markdown re-parse as one merged list, spawning a stray task item. Serialize
// empty paragraphs as `&nbsp;` (GFM renders it as a blank line) and parse them
// back to truly empty paragraphs on load.
export const ParagraphKeepBlank = Paragraph.extend({
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
							if (p.textContent === " ") p.textContent = "";
						}
					},
				},
			},
		};
	},
});

// tiptap-markdown escapes both `<` and `>` in text, so `->` saved as `-&gt;`.
// Only `<` can open an HTML tag. A `>` that starts a line could open a
// blockquote, so it stays escaped; every other `>` stays as written.
export const TextKeepGt = Text.extend({
	addStorage() {
		return {
			markdown: {
				serialize(state: MarkdownState, node: PMNode) {
					let text = (node.text ?? "").replace(/</g, "&lt;");
					// The serializer escapes a `>` in column zero only; after up to three
					// spaces it still opens a blockquote.
					if (state.atBlockStart) text = text.replace(/^(\s+)>/, "$1&gt;");
					state.text(text);
				},
				parse: {},
			},
		};
	},
});

// Loosely typed, as in wikilink-extension.ts: markdown-it isn't a direct
// dependency here.
type MarkdownItToken = {
	type: string;
	level: number;
	map: [number, number] | null;
	attrGet(name: string): string | null;
	attrSet(name: string, value: string): void;
};

type MarkdownItCoreState = { src: string; tokens: MarkdownItToken[] };

type MarkdownIt = {
	core: { ruler: { push(name: string, rule: (state: MarkdownItCoreState) => void): void } };
};

const GAP_BEFORE = "data-gap-before";
const BLANK_INSIDE = "data-blank-inside";

// tiptap-markdown runs `setup` on every parse; add the rule once per instance.
const withSpacingRule = new WeakSet<MarkdownIt>();

// markdown-it decides tight or loose for the whole list, so a blank line
// between the plain run and the task run makes every item loose. Mark, from
// the source lines, where each item of a task list had blank lines, so each
// run can stay tight after the split.
function markItemSpacing(state: MarkdownItCoreState) {
	const lines = state.src.split("\n");
	const isBlank = (line: number) => (lines[line] ?? "").trim() === "";
	// The last non-blank line before `end`: markdown-it maps include trailing blanks.
	const lastFilled = (end: number, start: number) => {
		let line = end - 1;
		while (line > start && isBlank(line)) line--;
		return line;
	};
	const { tokens } = state;
	for (let i = 0; i < tokens.length; i++) {
		const list = tokens[i];
		if (list.type !== "bullet_list_open" || list.attrGet("class") !== "contains-task-list")
			continue;
		let first = true;
		for (let j = i + 1; j < tokens.length; j++) {
			const token = tokens[j];
			if (token.type === "bullet_list_close" && token.level === list.level) break;
			if (token.type !== "list_item_open" || token.level !== list.level + 1 || !token.map) continue;
			const [start, end] = token.map;
			const last = lastFilled(end, start);
			// Blank lines inside a nested list make that list loose, not this item.
			const nested: [number, number][] = [];
			for (let k = j + 1; k < tokens.length; k++) {
				const inner = tokens[k];
				if (inner.type === "list_item_close" && inner.level === token.level) break;
				if (inner.type.endsWith("_list_open") && inner.level === token.level + 1 && inner.map) {
					nested.push([inner.map[0], lastFilled(inner.map[1], inner.map[0])]);
				}
			}
			const inNested = (line: number) => nested.some(([from, to]) => line >= from && line <= to);
			if (!first && isBlank(start - 1)) token.attrSet(GAP_BEFORE, "");
			for (let line = start + 1; line < last; line++) {
				if (isBlank(line) && !inNested(line)) token.attrSet(BLANK_INSIDE, "");
			}
			first = false;
		}
	}
}

// A markdown list with both plain items and `[ ]` items parses as one list
// marked as a task list. The editor's task list holds task items only, so it
// kept the plain items in a list of their own and filled the task list with an
// empty task. Split such a list into runs of plain and task items before the
// editor reads it.
export const SplitMixedTaskLists = Extension.create({
	name: "splitMixedTaskLists",
	addStorage() {
		return {
			markdown: {
				parse: {
					setup(md: MarkdownIt) {
						if (withSpacingRule.has(md)) return;
						withSpacingRule.add(md);
						md.core.ruler.push("task_list_item_spacing", markItemSpacing);
					},
					updateDOM(element: HTMLElement) {
						for (const list of element.querySelectorAll("ul.contains-task-list")) {
							const items = [...list.children].filter((child) => child.tagName === "LI");
							const isTask = (li: Element) => li.classList.contains("task-list-item");
							if (items.every(isTask)) continue;
							const runs: Element[][] = [];
							for (const li of items) {
								const run = runs.at(-1);
								if (run && isTask(run[0]) === isTask(li)) run.push(li);
								else runs.push([li]);
							}
							for (const run of runs) {
								const ul = isTask(run[0])
									? (list.cloneNode(false) as Element)
									: list.ownerDocument.createElement("ul");
								const tight = run.every(
									(li, k) =>
										!li.hasAttribute(BLANK_INSIDE) && (k === 0 || !li.hasAttribute(GAP_BEFORE)),
								);
								if (tight) ul.setAttribute("data-tight", "true");
								ul.append(...run);
								list.before(ul);
							}
							list.remove();
						}
						for (const li of element.querySelectorAll(`li[${GAP_BEFORE}], li[${BLANK_INSIDE}]`)) {
							li.removeAttribute(GAP_BEFORE);
							li.removeAttribute(BLANK_INSIDE);
						}
					},
				},
			},
		};
	},
});

// tiptap-markdown records whether a bullet or ordered list is tight (no blank
// line between items) but not a task list, so every task list saved loose.
// Give task lists the same `tight` attribute. Read it from the list's own
// items only: a loose nested list does not make its parent loose.
export const TaskListKeepTight = TaskList.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			tight: {
				default: true,
				parseHTML: (element: HTMLElement) =>
					element.getAttribute("data-tight") === "true" ||
					!element.querySelector(":scope > li > p"),
				renderHTML: (attributes: { tight: boolean }) => ({
					"data-tight": attributes.tight ? "true" : null,
				}),
			},
		};
	},
});
