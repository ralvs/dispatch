import { expect, type Locator, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { TiptapEditorHTMLElement } from "@tiptap/core";
import { readLocalStack } from "../integration/stack";

/**
 * Pipe tables in a note (#169, docs/adr/0009). A table the editor did not
 * touch saves byte for byte while the text around it changes, and a header
 * row plus Enter starts a new one.
 */

const stack = readLocalStack();
const sb = createClient(stack.apiUrl, stack.secretKey, {
	auth: { persistSession: false, autoRefreshToken: false },
});

const table = "| Item | Cost |\n|------|-----:|\n| Rent | 2000 |";
let noteId = "";

test.beforeAll(async () => {
	const note = await sb
		.from("notes")
		.insert({ title: `E2E Table ${Date.now()}`, body: `Intro\n\n${table}\n\nend` })
		.select("id")
		.single();
	if (note.error) throw note.error;
	noteId = note.data.id;
});

test.afterAll(async () => {
	await sb.from("notes").delete().eq("id", noteId);
});

async function savedBody() {
	const { data } = await sb.from("notes").select("body").eq("id", noteId).single();
	return data?.body;
}

// The editor reads a click's caret on the next `selectionchange`. Keys pressed
// before that land at the old caret, so wait until the editor has it.
async function clickInto(page: Page, paragraph: Locator, text: string) {
	await paragraph.click();
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					(document.querySelector(".ProseMirror") as TiptapEditorHTMLElement | null)?.editor?.state
						.selection.$from.parent.textContent,
			),
		)
		.toBe(text);
}

test("a table keeps its bytes, and a header row starts a new one", async ({ page }) => {
	await page.goto(`/notes/${noteId}`);
	const body = page.getByLabel("Note body");
	await expect(body.getByRole("table")).toBeVisible();
	await expect(body.getByRole("columnheader", { name: "Cost" })).toBeVisible();

	await clickInto(page, body.locator("p", { hasText: /^Intro$/ }), "Intro");
	await page.keyboard.press("End");
	await page.keyboard.type("!");
	await expect.poll(savedBody).toBe(`Intro!\n\n${table}\n\nend`);

	await clickInto(page, body.locator("p", { hasText: /^end$/ }), "end");
	await page.keyboard.press("End");
	await page.keyboard.press("Enter");
	await page.keyboard.type("| Name | Age |");
	await page.keyboard.press("Enter");
	await page.keyboard.type("Ana");
	await expect(body.getByRole("columnheader", { name: "Age" })).toBeVisible();
	await expect
		.poll(savedBody)
		.toContain(`${table}\n\nend\n\n| Name | Age |\n| --- | --- |\n| Ana |  |`);
	if (process.env.TABLE_SHOT) await page.screenshot({ path: process.env.TABLE_SHOT });
});
