import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, expect, it } from "vitest";

// Two copies of prosemirror-model in node_modules (a nested one left in
// bun.lock by a dependency bump) make every transform step throw "multiple
// versions of prosemirror-model were loaded". Enter is the first key to hit it.

let editor: Editor | undefined;
afterEach(() => {
	editor?.destroy();
	editor = undefined;
});

function make(content: string): Editor {
	editor = new Editor({ extensions: [StarterKit], content });
	return editor;
}

it("starts a new paragraph on Enter at the end of a line", () => {
	const e = make("<p>one</p>");
	e.commands.setTextSelection(4);
	e.view.someProp("handleKeyDown", (handler) =>
		handler(e.view, new KeyboardEvent("keydown", { key: "Enter" })),
	);
	expect(e.getHTML()).toBe("<p>one</p><p></p>");
});

it("wraps a paragraph in a quote", () => {
	const e = make("<p>one</p>");
	e.commands.setTextSelection(2);
	expect(e.commands.toggleBlockquote()).toBe(true);
	expect(e.getHTML()).toBe("<blockquote><p>one</p></blockquote><p></p>");
});
