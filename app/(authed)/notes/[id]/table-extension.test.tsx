import { Editor } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import StarterKit from "@tiptap/starter-kit";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";
import { afterEach, describe, expect, it } from "vitest";
import {
	BulletListKeepTight,
	OrderedListKeepTight,
	ParagraphKeepBlank,
	SplitMixedTaskLists,
	TaskListKeepTight,
	TextKeepGt,
} from "./markdown-fidelity";
import { NoteTable, NoteTableCell, NoteTableHeader, NoteTableRow } from "./table-extension";

let editor: Editor | undefined;
afterEach(() => {
	editor?.destroy();
	editor = undefined;
});

function make(content: string): Editor {
	editor?.destroy();
	editor = new Editor({
		extensions: [
			StarterKit.configure({
				paragraph: false,
				text: false,
				bulletList: false,
				orderedList: false,
			}),
			ParagraphKeepBlank,
			TextKeepGt,
			BulletListKeepTight,
			OrderedListKeepTight,
			TaskListKeepTight,
			TaskItem.configure({ nested: true }),
			NoteTable,
			NoteTableRow,
			NoteTableHeader,
			NoteTableCell,
			SplitMixedTaskLists,
			Markdown.configure({ html: true }),
		],
		content,
	});
	return editor;
}

function markdown(e: Editor): string {
	return (e.storage as unknown as { markdown: MarkdownStorage }).markdown.getMarkdown();
}

function roundTrip(content: string): string {
	return markdown(make(content));
}

function cellTexts(e: Editor): string[] {
	const texts: string[] = [];
	e.state.doc.descendants((node) => {
		if (node.type.name === "tableHeader" || node.type.name === "tableCell") {
			texts.push(`${node.type.name === "tableHeader" ? "th" : "td"}:${node.textContent}`);
		}
	});
	return texts;
}

// Put the cursor at the end of the cell holding `text`.
function cursorAfter(e: Editor, text: string) {
	let at = -1;
	e.state.doc.descendants((node, pos) => {
		if (at === -1 && node.isText && node.text === text) at = pos + text.length;
	});
	e.commands.setTextSelection(at);
}

function pressEnter(e: Editor) {
	e.view.someProp("handleKeyDown", (handler) =>
		handler(e.view, new KeyboardEvent("keydown", { key: "Enter" })),
	);
}

describe("opening a pipe table", () => {
	it("reads the header and body cells", () => {
		const e = make("| Name | Age |\n| --- | --- |\n| Ana | 34 |");
		expect(cellTexts(e)).toEqual(["th:Name", "th:Age", "td:Ana", "td:34"]);
	});

	it("keeps inline marks in a cell", () => {
		const e = make("| a |\n| --- |\n| **bold** |");
		expect(e.getHTML()).toContain("<strong>bold</strong>");
	});
});

describe("saving an unedited table", () => {
	it.each([
		["the editor's own spelling", "| Name | Age |\n| --- | --- |\n| Ana | 34 |"],
		["compact pipes", "|Name|Age|\n|-|-|\n|Ana|34|"],
		["no outer pipes", "Name | Age\n--- | ---\nAna | 34"],
		["padded columns", "| Name | Age |\n|------|----:|\n| Ana  |  34 |\n| Bob  |   7 |"],
		["alignment", "| L | C | R |\n|:--|:-:|--:|\n| a | b | c |"],
		["escaped pipes and code", "| expr |\n| --- |\n| `a \\| b` and c\\|d |"],
		["an empty cell", "| a | b |\n| --- | --- |\n|  | x |"],
		["a header with no body", "| a | b |\n| --- | --- |"],
	])("keeps %s byte for byte", (_name, table) => {
		expect(roundTrip(table)).toBe(table);
	});

	it("keeps the blocks around it", () => {
		const body = "# Budget\n\nBefore.\n\n| Item | Cost |\n|--|--:|\n| Rent | 2000 |\n\nAfter.";
		expect(roundTrip(body)).toBe(body);
	});

	it("keeps two tables apart", () => {
		const body = "|a|\n|-|\n|1|\n\n|b|\n|-|\n|2|";
		expect(roundTrip(body)).toBe(body);
	});

	it("is still byte for byte after an edit somewhere else", () => {
		const e = make("Intro\n\n|Name|Age|\n|-|-|\n|Ana|34|\n\nend");
		cursorAfter(e, "Intro");
		e.commands.insertContent("!");
		expect(markdown(e)).toBe("Intro!\n\n|Name|Age|\n|-|-|\n|Ana|34|\n\nend");
	});
});

describe("saving an edited table", () => {
	it("writes it as a pipe table and keeps the alignment", () => {
		const e = make("Name|Age\n:-|-:\nAna|34\n\nend");
		cursorAfter(e, "Ana");
		e.commands.insertContent(" B");
		expect(markdown(e)).toBe("| Name | Age |\n| :--- | ---: |\n| Ana B | 34 |\n\nend");
	});

	it("escapes a pipe typed into a cell, inside code too", () => {
		const e = make("| a |\n| --- |\n| x |\n\nend");
		cursorAfter(e, "x");
		e.commands.insertContent(" | y");
		const out = markdown(e);
		expect(out).toBe("| a |\n| --- |\n| x \\| y |\n\nend");
		expect(cellTexts(make(out))).toEqual(["th:a", "td:x | y"]);
	});

	it("keeps an escaped pipe in code through an edit", () => {
		const e = make("| a |\n| --- |\n| `p\\|q` |\n\nend");
		cursorAfter(e, "a");
		e.commands.insertContent("b");
		const out = markdown(e);
		expect(out).toBe("| ab |\n| --- |\n| `p\\|q` |\n\nend");
		expect(cellTexts(make(out))).toEqual(["th:ab", "td:p|q"]);
	});

	it("writes an opened table fresh once it moves into a quote", () => {
		const e = make("| a |\n| --- |\n| 1 |\n\nend");
		// Wrap the table node itself, as dragging it into a quote would.
		const { doc, schema, tr } = e.state;
		const range = doc.resolve(0).blockRange(doc.resolve(doc.child(0).nodeSize));
		if (!range) throw new Error("no range");
		e.view.dispatch(tr.wrap(range, [{ type: schema.nodes.blockquote }]));
		const out = markdown(e);
		expect(out).toBe("> | a |\n> | --- |\n> | 1 |\n\nend");
		expect(cellTexts(make(out))).toEqual(["th:a", "td:1"]);
	});

	it("writes a table inside a list fresh, and it opens as the same table", () => {
		const out = roundTrip("- item\n\n  |a|\n  |-|\n  |1|");
		expect(cellTexts(make(out))).toEqual(["th:a", "td:1"]);
		expect(out).not.toContain("<table");
	});
});

describe("a table only a pipe table can hold", () => {
	it("drops merged cells to plain ones instead of saving HTML", () => {
		const e = make("x");
		e.commands.setContent(
			"<table><tr><th>a</th><th>b</th></tr><tr><td colspan='2'>wide</td></tr></table><p>end</p>",
		);
		const out = markdown(e);
		expect(out).not.toContain("<");
		expect(out).toBe("| a | b |\n| --- | --- |\n| wide |  |\n\nend");
	});

	it("keeps a pasted cell to one line, its blocks joined by line breaks", () => {
		const e = make("x");
		e.commands.setContent(
			"<table><tr><th>a</th></tr><tr><td><p>one</p><ul><li>two</li></ul></td></tr></table><p>end</p>",
		);
		const out = markdown(e);
		expect(out).toBe("| a |\n| --- |\n| one<br>two |\n\nend");
		expect(make(out).getHTML()).toContain("<p>one<br>two</p></td>");
	});
});

describe("starting a table", () => {
	it("turns a header row into a table on Enter", () => {
		const e = make("| Name | Age |\n\nend");
		cursorAfter(e, "| Name | Age |");
		pressEnter(e);
		expect(cellTexts(e)).toEqual(["th:Name", "th:Age", "td:", "td:"]);
		e.commands.insertContent("Ana");
		expect(markdown(e)).toBe("| Name | Age |\n| --- | --- |\n| Ana |  |\n\nend");
	});

	it("leaves a line that is not a header row alone", () => {
		for (const line of ["a | b", "| a | b", "||"]) {
			const e = make(line);
			cursorAfter(e, line);
			pressEnter(e);
			expect(cellTexts(e)).toEqual([]);
		}
	});
});
