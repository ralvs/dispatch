import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readLocalStack } from "../integration/stack";

/**
 * The open note reads its row from the entity store (docs/adr/0079). An edit
 * saved on the page is there when the note is opened again from /notes — the
 * router may replay an older render of the page, and the store's newer row
 * wins — and a filing survives a reload. Uploads are left out: they need R2.
 */

const stack = readLocalStack();
const sb = createClient(stack.apiUrl, stack.secretKey, {
	auth: { persistSession: false, autoRefreshToken: false },
});

const stamp = Date.now();
const title = `E2E Note ${stamp}`;
// auth.setup.ts seeds this domain before any page loads. A domain inserted
// here could miss the cached domain list another spec has already filled.
const domainName = "E2E Domain";
const typed = `Typed in the browser ${stamp}`;
let noteId = "";
let domainId = "";

test.beforeAll(async () => {
	const domain = await sb
		.from("stewardship_domains")
		.select("id")
		.eq("name", domainName)
		.limit(1)
		.single();
	if (domain.error) throw domain.error;
	domainId = domain.data.id;
	const note = await sb.from("notes").insert({ title, body: "Seeded body" }).select("id").single();
	if (note.error) throw note.error;
	noteId = note.data.id;
});

test.afterAll(async () => {
	await sb.from("notes").delete().eq("id", noteId);
});

test("a note's edit survives reopening, and its filing survives a reload", async ({ page }) => {
	await page.goto(`/notes/${noteId}`);
	await expect(page.getByLabel("Note title")).toHaveValue(title);

	const body = page.getByLabel("Note body");
	await body.click();
	await page.keyboard.press("End");
	await page.keyboard.type(` ${typed}`);
	await expect(page.getByText("Saved")).toBeVisible();

	await page.getByRole("link", { name: "Notes" }).first().click();
	await page.waitForURL("**/notes");
	await page.getByRole("link", { name: title }).click();
	await page.waitForURL(`**/notes/${noteId}`);
	await expect(page.getByLabel("Note body")).toContainText(typed);

	await page.getByLabel("Domain", { exact: true }).selectOption({ label: domainName });
	await expect(page.getByLabel("Domain", { exact: true })).toHaveValue(domainId);
	// The filing is a server write: wait for it before reading the page again.
	await expect
		.poll(async () => {
			const { data } = await sb.from("notes").select("domain_id").eq("id", noteId).single();
			return data?.domain_id;
		})
		.toBe(domainId);

	await page.reload();
	await expect(page.getByLabel("Domain", { exact: true })).toHaveValue(domainId);
	await expect(page.getByLabel("Note body")).toContainText(typed);
});
