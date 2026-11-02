import type { Editor } from "@tiptap/core";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { DOMParser, Fragment, type Node as PMNode, type Schema } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";

// GFM pipe tables in a note (docs/adr/0009 amendment). The stored body stays
// markdown: every table the editor holds can be written as a pipe table, so
// nothing falls back to HTML. Cells hold one paragraph and never span, which
// is all a pipe table can say.

type MarkdownState = {
	out: string;
	inTable: boolean;
	write(text: string): void;
	ensureNewLine(): void;
	renderInline(node: PMNode): void;
	closeBlock(node: PMNode): void;
};

type SerializeContext = { editor: Editor };

// Loosely typed, as in markdown-fidelity.ts: markdown-it isn't a direct
// dependency here.
type MarkdownItToken = {
	type: string;
	level: number;
	map: [number, number] | null;
	attrSet(name: string, value: string): void;
};

type MarkdownItCoreState = { src: string; tokens: MarkdownItToken[] };

type MarkdownIt = {
	core: { ruler: { push(name: string, rule: (state: MarkdownItCoreState) => void): void } };
};

const SOURCE = "data-markdown-source";

// tiptap-markdown runs `setup` on every parse; add the rule once per instance.
const withSourceRule = new WeakSet<MarkdownIt>();

// The serializer writes one spelling of a table: `| a | b |` with `| --- |`.
// A table written another way (no outer pipes, padded columns, `|:-:|`) would
// change on save just by opening the note. Keep each top-level table's source
// lines, and write them back while the table is the one that was opened. A
// table inside a list or quote has its markers in those lines, so it is always
// written fresh.
function keepTableSource(state: MarkdownItCoreState) {
	const lines = state.src.split("\n");
	for (const token of state.tokens) {
		if (token.type !== "table_open" || token.level !== 0 || !token.map) continue;
		const [start, end] = token.map;
		let last = end;
		while (last > start && (lines[last - 1] ?? "").trim() === "") last--;
		token.attrSet(SOURCE, lines.slice(start, last).join("\n"));
	}
}

// The tables as parsed, before any edit. ProseMirror keeps a node that no
// transaction touched as the same object, so a table still in this set is
// unedited and its source lines still say exactly what it holds.
const openedTables = new PluginKey<WeakSet<PMNode>>("openedTables");

function isOpened(editor: Editor, node: PMNode): boolean {
	return openedTables.getState(editor.state)?.has(node) ?? false;
}

const DELIMITER: Record<string, string> = { left: ":---", center: ":---:", right: "---:" };

function writeTable(state: MarkdownState, node: PMNode) {
	state.inTable = true;
	node.forEach((row, _offset, rowIndex) => {
		state.write("| ");
		row.forEach((cell, _cellOffset, cellIndex) => {
			if (cellIndex) state.write(" | ");
			const start = state.out.length;
			const paragraph = cell.firstChild;
			// Spaces alone are an empty cell; an inline atom with no text is not.
			const blank =
				!paragraph ||
				(!paragraph.textContent.trim() && paragraph.content.content.every((child) => child.isText));
			if (!blank) state.renderInline(paragraph);
			// A `|` ends the cell wherever it is, even inside code: escape them all.
			state.out = state.out.slice(0, start) + state.out.slice(start).replace(/\|/g, "\\|");
		});
		state.write(" |");
		state.ensureNewLine();
		if (rowIndex === 0) {
			const delimiters: string[] = [];
			row.forEach((cell) => {
				delimiters.push(DELIMITER[cell.attrs.align as string] ?? "---");
			});
			state.write(`| ${delimiters.join(" | ")} |`);
			state.ensureNewLine();
		}
	});
	state.closeBlock(node);
	state.inTable = false;
}

// Header row `| a | b |` + Enter starts a table, as `- ` starts a list
// (docs/adr/0009). Split on the pipes a markdown table would split on.
const HEADER_ROW = /^\|(?:[^|]*(?:\\\|[^|]*)*\|)+\s*$/;

function headerCells(text: string): string[] {
	return text
		.trim()
		.slice(1, -1)
		.split(/(?<!\\)\|/)
		.map((cell) => cell.replace(/\\\|/g, "|").trim());
}

export const NoteTable = Table.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			source: {
				default: null,
				parseHTML: (element: HTMLElement) => element.getAttribute(SOURCE),
				// Never in the DOM: a copied table is a new table.
				renderHTML: () => ({}),
			},
		};
	},
	addProseMirrorPlugins() {
		return [
			...(this.parent?.() ?? []),
			new Plugin({
				key: openedTables,
				state: {
					init: (_config, { doc }) => {
						const opened = new WeakSet<PMNode>();
						doc.forEach((node) => {
							if (node.type.name === this.name && node.attrs.source !== null) opened.add(node);
						});
						return opened;
					},
					apply: (_tr, opened) => opened,
				},
			}),
		];
	},
	addKeyboardShortcuts() {
		return {
			...this.parent?.(),
			Enter: ({ editor }) => {
				const { $from, empty } = editor.state.selection;
				const paragraph = $from.parent;
				if (
					!empty ||
					$from.depth !== 1 ||
					paragraph.type.name !== "paragraph" ||
					$from.parentOffset !== paragraph.content.size ||
					!HEADER_ROW.test(paragraph.textContent)
				) {
					return false;
				}
				const names = headerCells(paragraph.textContent);
				if (names.every((name) => name === "")) return false;
				const { schema } = editor.state;
				const { tableHeader, tableCell, tableRow, paragraph: para } = schema.nodes;
				const header = tableRow.create(
					null,
					names.map((name) =>
						tableHeader.create(null, para.create(null, name ? schema.text(name) : null)),
					),
				);
				const body = tableRow.create(
					null,
					names.map(() => tableCell.create(null, para.create())),
				);
				const table = schema.nodes[this.name].create(null, [header, body]);
				const from = $from.before();
				const tr = editor.state.tr.replaceWith(from, $from.after(), table);
				// Into the first body cell: table, header row, then row and cell and paragraph.
				const firstBodyCell = from + 1 + header.nodeSize + 3;
				tr.setSelection(TextSelection.create(tr.doc, firstBodyCell));
				editor.view.dispatch(tr.scrollIntoView());
				return true;
			},
		};
	},
	addStorage() {
		return {
			markdown: {
				serialize(this: SerializeContext, state: MarkdownState, node: PMNode, parent: PMNode) {
					// A table moved into a list or quote is still the same node, but its
					// source lines lack that block's markers: write it fresh.
					if (parent.type.name === "doc" && isOpened(this.editor, node)) {
						state.write(node.attrs.source);
						state.closeBlock(node);
						return;
					}
					writeTable(state, node);
				},
				parse: {
					setup(md: MarkdownIt) {
						if (withSourceRule.has(md)) return;
						withSourceRule.add(md);
						md.core.ruler.push("table_source", keepTableSource);
					},
				},
			},
		};
	},
	// The wrapper scrolls a wide table instead of widening the note.
}).configure({ resizable: false, renderWrapper: true });

export const NoteTableRow = TableRow;

// A pipe table cell is one line of inline text, and has no way to span. A
// pasted cell with more than one block keeps its text on one line, the blocks
// joined by line breaks (`<br>`, as GFM writes them).
function oneParagraph(element: HTMLElement, schema: Schema): Fragment {
	const inline: PMNode[] = [];
	DOMParser.fromSchema(schema)
		.parseSlice(element)
		.content.descendants((node) => {
			if (node.isTextblock) {
				if (inline.length > 0 && node.childCount > 0) inline.push(schema.nodes.hardBreak.create());
				node.forEach((child) => {
					inline.push(child);
				});
				return false;
			}
			if (node.isInline) {
				inline.push(node);
				return false;
			}
			return true;
		});
	return Fragment.from(schema.nodes.paragraph.create(null, inline));
}

function pipeCell(tag: "td" | "th") {
	return {
		content: "paragraph",
		parseHTML() {
			return [
				{
					tag,
					getContent: (node: globalThis.Node, schema: Schema) =>
						oneParagraph(node as HTMLElement, schema),
				},
			];
		},
		addAttributes(this: { parent?: () => Record<string, unknown> }) {
			return {
				...this.parent?.(),
				colspan: { default: 1, parseHTML: () => 1 },
				rowspan: { default: 1, parseHTML: () => 1 },
			};
		},
	};
}

export const NoteTableHeader = TableHeader.extend(pipeCell("th"));
export const NoteTableCell = TableCell.extend(pipeCell("td"));
