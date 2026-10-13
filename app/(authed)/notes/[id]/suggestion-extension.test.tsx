import { act, waitFor } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { Mention } from "./mention-extension";
import { createMentionSuggestionExtension } from "./mention-suggestion";
import { createSuggestionExtension } from "./suggestion-extension";
import { Wikilink } from "./wikilink-extension";
import { createWikilinkSuggestionExtension } from "./wikilink-suggestion";

const SELF = "00000000-0000-4000-8000-000000000000";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

let editor: Editor | undefined;
afterEach(() => {
	act(() => editor?.destroy());
	editor = undefined;
	document.body.innerHTML = "";
});

function make(extensions: Editor["options"]["extensions"]): Editor {
	editor = new Editor({ extensions: [StarterKit, ...extensions], content: "" });
	return editor;
}

async function type(e: Editor, text: string) {
	act(() => {
		e.commands.focus("end");
		e.commands.insertContent(text);
	});
	// The suggestion plugin resolves items asynchronously, then mounts the panel.
	await waitFor(() => expect(document.body.querySelector("li, div[style] > div")).not.toBeNull());
}

function key(e: Editor, k: string) {
	act(() => {
		e.view.dom.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
	});
}

function options(): string[] {
	return [...document.body.querySelectorAll("li button")].map((b) => b.textContent ?? "");
}

function nodesOf(e: Editor, name: string): Array<Record<string, unknown>> {
	const found: Array<Record<string, unknown>> = [];
	e.state.doc.descendants((node) => {
		if (node.type.name === name) found.push(node.attrs);
	});
	return found;
}

const notes = [
	{ id: SELF, title: "This note", body: "" },
	{ id: A, title: "Weekly plan", body: "" },
	{ id: B, title: "Reading list", body: "" },
];

describe("the [[ wikilink autocomplete", () => {
	it("offers every other note on an empty query, never the note itself", async () => {
		const e = make([Wikilink, createWikilinkSuggestionExtension(notes, SELF)]);
		await type(e, "[[");
		expect(options()).toEqual(["Weekly plan", "Reading list"]);
	});

	it("filters by title, case-insensitively", async () => {
		const e = make([Wikilink, createWikilinkSuggestionExtension(notes, SELF)]);
		await type(e, "[[WEEK");
		expect(options()).toEqual(["Weekly plan"]);
	});

	it("shows the empty label when nothing matches", async () => {
		const e = make([Wikilink, createWikilinkSuggestionExtension(notes, SELF)]);
		await type(e, "[[zzz");
		expect(options()).toEqual([]);
		expect(document.body.textContent).toContain("No matching notes");
	});

	it("inserts the picked note as a wikilink node plus a trailing space", async () => {
		const e = make([Wikilink, createWikilinkSuggestionExtension(notes, SELF)]);
		await type(e, "[[read");
		key(e, "Enter");
		expect(nodesOf(e, "wikilink")).toEqual([{ id: B, label: "Reading list" }]);
		expect(e.getText()).toBe(`[[${B}|Reading list]] `);
		expect(options()).toEqual([]);
	});

	it("moves the selection with the arrow keys and wraps", async () => {
		const e = make([Wikilink, createWikilinkSuggestionExtension(notes, SELF)]);
		await type(e, "[[");
		key(e, "ArrowUp");
		key(e, "Enter");
		expect(nodesOf(e, "wikilink")).toEqual([{ id: B, label: "Reading list" }]);
	});

	it("closes on Escape without inserting", async () => {
		const e = make([Wikilink, createWikilinkSuggestionExtension(notes, SELF)]);
		await type(e, "[[week");
		key(e, "Escape");
		expect(options()).toEqual([]);
		expect(nodesOf(e, "wikilink")).toEqual([]);
	});
});

describe("the @ mention autocomplete", () => {
	it("reads the people pool on every keystroke and matches accent-insensitively", async () => {
		const people = [{ id: A, name: "João Silva" }];
		const e = make([Mention, createMentionSuggestionExtension(() => people)]);
		people.push({ id: B, name: "Joana" });
		await type(e, "@joa");
		expect(options()).toEqual(["João Silva", "Joana"]);
	});

	it("inserts the picked person as a mention node", async () => {
		const e = make([Mention, createMentionSuggestionExtension(() => [{ id: A, name: "Ana" }])]);
		await type(e, "@an");
		key(e, "Enter");
		expect(nodesOf(e, "mention")).toEqual([{ id: A, name: "Ana" }]);
	});
});

describe("createSuggestionExtension", () => {
	it("caps the dropdown at eight results", async () => {
		const items = Array.from({ length: 12 }, (_, i) => ({ id: `id-${i}`, name: `Item ${i}` }));
		const e = make([
			createSuggestionExtension({
				name: "testSuggestion",
				char: "#",
				items,
				matches: () => true,
				label: (i) => i.name,
				emptyLabel: "none",
				toNode: () => ({ type: "text", attrs: {} }),
			}),
		]);
		await type(e, "#");
		expect(options()).toHaveLength(8);
	});

	it("lets two instances share one editor (distinct plugin keys)", () => {
		expect(() =>
			make([
				Wikilink,
				createWikilinkSuggestionExtension(notes, SELF),
				Mention,
				createMentionSuggestionExtension(() => []),
			]),
		).not.toThrow();
	});
});
