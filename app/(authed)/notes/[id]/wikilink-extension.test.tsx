import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";
import { afterEach, describe, expect, it } from "vitest";
import { Wikilink } from "./wikilink-extension";

const ID = "11111111-2222-4333-8444-555555555555";

let editor: Editor | undefined;
afterEach(() => {
	editor?.destroy();
	editor = undefined;
});

function make(content: string): Editor {
	editor = new Editor({ extensions: [StarterKit, Wikilink, Markdown], content });
	return editor;
}

function markdown(e: Editor): string {
	return (e.storage as unknown as { markdown: MarkdownStorage }).markdown.getMarkdown();
}

function wikilinks(e: Editor): Array<Record<string, unknown>> {
	const found: Array<Record<string, unknown>> = [];
	e.state.doc.descendants((node) => {
		if (node.type.name === "wikilink") found.push(node.attrs);
	});
	return found;
}

describe("Wikilink extension", () => {
	it("parses a [[uuid|label]] token into a wikilink node", () => {
		const e = make(`See [[${ID}|Weekly plan]] today`);
		expect(wikilinks(e)).toEqual([{ id: ID, label: "Weekly plan" }]);
		expect(e.getText()).toContain(`[[${ID}|Weekly plan]]`);
	});

	it("round-trips the token through markdown unchanged", () => {
		const e = make(`See [[${ID}|Weekly plan]] today`);
		expect(markdown(e)).toBe(`See [[${ID}|Weekly plan]] today`);
	});

	it("leaves a token whose id is not a uuid as plain text", () => {
		const e = make("See [[not-a-uuid|Plan]] today");
		expect(wikilinks(e)).toEqual([]);
		expect(e.getText()).toContain("[[not-a-uuid|Plan]]");
	});

	it("renders a link to the target note", () => {
		const e = make(`[[${ID}|Plan]]`);
		const a = e.view.dom.querySelector("a[data-wikilink]");
		expect(a?.getAttribute("href")).toBe(`/notes/${ID}`);
		expect(a?.getAttribute("data-id")).toBe(ID);
		expect(a?.textContent).toBe("Plan");
	});

	it("sanitizes the label on serialize", () => {
		const e = make("");
		e.commands.insertContent({ type: "wikilink", attrs: { id: ID, label: "a|b [c]\nd" } });
		expect(markdown(e)).toBe(`[[${ID}|ab c d]]`);
	});

	it("serializes an empty label as Untitled", () => {
		const e = make("");
		e.commands.insertContent({ type: "wikilink", attrs: { id: ID, label: "" } });
		expect(markdown(e)).toBe(`[[${ID}|Untitled]]`);
	});
});
