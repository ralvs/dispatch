import { Editor } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import StarterKit from "@tiptap/starter-kit";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";
import { afterEach, describe, expect, it } from "vitest";
import {
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

function make(content: string): Editor {
	editor?.destroy();
	editor = new Editor({
		extensions: [
			StarterKit.configure({ paragraph: false, text: false }),
			ParagraphKeepBlank,
			TextKeepGt,
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
		expect(roundTrip(once)).toBe(once);
		expect(once).not.toContain("&nbsp;");
	});

	it("leaves a pure task list alone", () => {
		expect(roundTrip("- [ ] a\n- [x] b")).toBe("- [ ] a\n- [x] b");
	});
});

describe("task list spacing", () => {
	it("keeps a loose task list loose", () => {
		expect(roundTrip("- [ ] a\n\n- [x] b")).toBe("- [ ] a\n\n- [x] b");
	});

	it("keeps a nested task list tight", () => {
		const body = "- [ ] a\n  - [x] a1\n  - [ ] a2\n- [ ] b";
		expect(roundTrip(body)).toBe(body);
	});
});
