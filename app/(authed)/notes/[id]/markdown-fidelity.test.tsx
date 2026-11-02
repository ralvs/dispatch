import { Editor, type JSONContent } from "@tiptap/core";
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

let editor: Editor | undefined;
afterEach(() => {
	editor?.destroy();
	editor = undefined;
});

function make(content: string | JSONContent): Editor {
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

function nodeNames(e: Editor): string[] {
	const names: string[] = [];
	e.state.doc.descendants((node) => {
		names.push(node.type.name);
	});
	return names;
}

describe("text", () => {
	it("keeps a > in text as written", () => {
		expect(roundTrip("pensou 1 coisa ruim -> pense 2 coisas boas")).toBe(
			"pensou 1 coisa ruim -> pense 2 coisas boas",
		);
	});

	it("still escapes < so text never turns into HTML", () => {
		const out = roundTrip("run \\<port> now");
		expect(out).toBe("run &lt;port> now");
		expect(make(out).getText()).toBe("run <port> now");
	});

	it("still escapes a > at the start of a list item", () => {
		for (const body of ["- \\> not a quote", "- [ ] > not a quote"]) {
			const out = roundTrip(body);
			expect(out).toMatch(/\\> not a quote$/);
			expect(nodeNames(make(out))).not.toContain("blockquote");
		}
	});

	it("never turns a > after leading spaces into a quote", () => {
		const paragraph: JSONContent = {
			type: "paragraph",
			content: [{ type: "text", text: "  > not a quote" }],
		};
		const docs: JSONContent[] = [
			{ type: "doc", content: [paragraph] },
			{
				type: "doc",
				content: [{ type: "bulletList", content: [{ type: "listItem", content: [paragraph] }] }],
			},
		];
		for (const doc of docs) {
			const out = markdown(make(doc));
			expect(nodeNames(make(out))).not.toContain("blockquote");
			expect(make(out).getText()).toContain("> not a quote");
		}
	});

	it("never turns a > after a hard break into a quote", () => {
		const out = markdown(
			make({
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [
							{ type: "text", text: "a" },
							{ type: "hardBreak" },
							{ type: "text", text: "> not a quote" },
						],
					},
				],
			}),
		);
		const names = nodeNames(make(out));
		expect(names).not.toContain("blockquote");
		expect(names).toContain("hardBreak");
		expect(make(out).getText()).toContain("> not a quote");
	});

	it("keeps text that looks like an entity as that text", () => {
		const body = "write &amp;lt; or &amp;#60; or &amp;amp;";
		expect(make(body).getText()).toBe("write &lt; or &#60; or &amp;");
		expect(roundTrip(body)).toBe(body);
	});

	it("saves an entity as text that means the same and stays put", () => {
		const out = roundTrip("AT&amp;T and &lt;b&gt; and &#60;");
		expect(make(out).getText()).toBe("AT&T and <b> and <");
		expect(roundTrip(out)).toBe(out);
	});

	it("keeps a bare & and a text that is not an entity as written", () => {
		for (const body of ["AT&T & co", "a &foo; b", "R&D;"]) {
			expect(roundTrip(body)).toBe(body);
		}
	});

	it("keeps a real quote as a quote", () => {
		expect(roundTrip("> a real quote")).toBe("> a real quote");
	});

	it("still escapes a > at the start of a line", () => {
		const out = roundTrip("\\> not a quote");
		expect(out).toBe("\\> not a quote");
		expect(nodeNames(make(out))).not.toContain("blockquote");
	});
});

describe("a list that mixes plain and task items", () => {
	it("keeps plain items as bullets and adds no empty task", () => {
		const e = make("- a\n- b\n\n\n- [x] c\n- [ ] d");
		expect(nodeNames(e).filter((n) => n === "taskItem")).toHaveLength(2);
		expect(markdown(e)).toBe("- a\n- b\n\n- [x] c\n- [ ] d");
	});

	it("keeps a run loose when its own items had blank lines", () => {
		expect(roundTrip("- a\n\n- b\n\n- [x] c\n- [ ] d")).toBe("- a\n\n- b\n\n- [x] c\n- [ ] d");
	});

	it("keeps a run tight when only a nested list had blank lines", () => {
		const body = "- a\n  - a1\n\n  - a2\n- b\n\n- [x] c\n- [ ] d";
		expect(roundTrip(body)).toBe(body);
	});

	it("keeps an item with two paragraphs loose", () => {
		const body = "- a\n\n  more a\n- [x] c";
		expect(roundTrip(body)).toBe("- a\n\n  more a\n\n- [x] c");
	});

	it("handles a plain item that starts with a link", () => {
		const out = roundTrip("- [x] done\n- [10 repos](https://example.com) — May 16\n- next");
		expect(out).toBe("- [x] done\n\n- [10 repos](https://example.com) — May 16\n- next");
		expect(out).not.toContain("&nbsp;");
	});

	it("is stable on a second round trip", () => {
		const once = roundTrip("- a\n- [ ] b\n- c\n- [x] d");
		expect(once).toBe("- a\n\n- [ ] b\n\n- c\n\n- [x] d");
		expect(roundTrip(once)).toBe(once);
	});

	it("leaves a pure task list alone", () => {
		expect(roundTrip("- [ ] a\n- [x] b")).toBe("- [ ] a\n- [x] b");
	});
});

describe("list spacing", () => {
	it("keeps a bullet list tight when only its nested list is loose", () => {
		const body = "- a\n  - b\n\n  - c\n- d";
		expect(roundTrip(body)).toBe(body);
	});

	it("keeps an ordered list tight when only its nested list is loose", () => {
		const body = "1. a\n   - b\n\n   - c\n2. d";
		expect(roundTrip(body)).toBe(body);
	});

	it("keeps a loose bullet list loose", () => {
		expect(roundTrip("- a\n\n- b")).toBe("- a\n\n- b");
	});
});

describe("numbered task list", () => {
	it("keeps the numbers and the tasks", () => {
		const e = make("1. [ ] a\n2. [x] b");
		expect(nodeNames(e).filter((n) => n === "taskItem")).toHaveLength(2);
		expect(nodeNames(e)).not.toContain("orderedList");
		expect(markdown(e)).toBe("1. [ ] a\n2. [x] b");
	});

	it("keeps the start number", () => {
		expect(roundTrip("3. [ ] a\n4. [x] b")).toBe("3. [ ] a\n4. [x] b");
	});

	it("keeps a loose numbered task list loose", () => {
		expect(roundTrip("1. [ ] a\n\n2. [x] b")).toBe("1. [ ] a\n\n2. [x] b");
	});

	it("keeps a nested numbered task list", () => {
		const body = "- [ ] a\n  1. [x] a1\n  2. [ ] a2\n- [ ] b";
		expect(roundTrip(body)).toBe(body);
	});
});

describe("task list spacing", () => {
	it("keeps a loose task list loose", () => {
		expect(roundTrip("- [ ] a\n\n- [x] b")).toBe("- [ ] a\n\n- [x] b");
	});

	it("keeps a task list tight when only its nested list is loose", () => {
		const body = "- [ ] a\n  - b\n\n  - c\n- [ ] d";
		expect(roundTrip(body)).toBe(body);
	});

	it("keeps a nested task list tight", () => {
		const body = "- [ ] a\n  - [x] a1\n  - [ ] a2\n- [ ] b";
		expect(roundTrip(body)).toBe(body);
	});
});
