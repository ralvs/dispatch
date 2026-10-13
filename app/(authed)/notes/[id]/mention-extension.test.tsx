import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";
import { afterEach, describe, expect, it } from "vitest";
import { Mention } from "./mention-extension";

const ID = "11111111-2222-4333-8444-555555555555";

let editor: Editor | undefined;
afterEach(() => {
	editor?.destroy();
	editor = undefined;
});

function make(content: string): Editor {
	editor = new Editor({ extensions: [StarterKit, Mention, Markdown], content });
	return editor;
}

function markdown(e: Editor): string {
	return (e.storage as unknown as { markdown: MarkdownStorage }).markdown.getMarkdown();
}

function mentions(e: Editor): Array<Record<string, unknown>> {
	const found: Array<Record<string, unknown>> = [];
	e.state.doc.descendants((node) => {
		if (node.type.name === "mention") found.push(node.attrs);
	});
	return found;
}

describe("Mention extension", () => {
	it("parses an @[uuid|Name] token into a mention node, without the @ in the name", () => {
		const e = make(`Call @[${ID}|João Silva] tomorrow`);
		expect(mentions(e)).toEqual([{ id: ID, name: "João Silva" }]);
	});

	it("round-trips the token through markdown unchanged", () => {
		const e = make(`Call @[${ID}|João Silva] tomorrow`);
		expect(markdown(e)).toBe(`Call @[${ID}|João Silva] tomorrow`);
	});

	it("leaves a plain @Name as text", () => {
		const e = make("Call @Ana tomorrow");
		expect(mentions(e)).toEqual([]);
		expect(markdown(e)).toBe("Call @Ana tomorrow");
	});

	it("renders a chip linking to the person", () => {
		const e = make(`@[${ID}|Ana]`);
		const a = e.view.dom.querySelector("a[data-mention]");
		expect(a?.getAttribute("href")).toBe(`/people/${ID}`);
		expect(a?.getAttribute("data-id")).toBe(ID);
		expect(a?.textContent).toBe("@Ana");
	});

	it("serializes an inserted mention node as the token", () => {
		const e = make("");
		e.commands.insertContent({ type: "mention", attrs: { id: ID, name: "Ana" } });
		expect(markdown(e)).toBe(`@[${ID}|Ana]`);
		expect(e.getText()).toBe(`@[${ID}|Ana]`);
	});
});
