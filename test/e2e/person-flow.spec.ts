import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readLocalStack } from "../integration/stack";

/**
 * People move without a page render (#30). A person added on /people shows at
 * once; deleting them from their page lands back on /people — never on the
 * not-found page, although the action's refresh re-reads the page it was
 * called from — and they are gone from the list.
 */

const stack = readLocalStack();
const sb = createClient(stack.apiUrl, stack.secretKey, {
	auth: { persistSession: false, autoRefreshToken: false },
});

const name = `E2E Person ${Date.now()}`;

test.afterAll(async () => {
	await sb.from("people").delete().eq("name", name);
});

test("add a person, open them, delete them: back on /people, never on not-found", async ({
	page,
}) => {
	await page.goto("/people");
	await page.getByRole("button", { name: "New person" }).click();
	await page.getByRole("dialog").getByLabel("Person name").fill(name);
	await page.getByRole("button", { name: "Add person" }).click();

	const row = page.getByRole("link", { name });
	await expect(row).toBeVisible();
	await row.click();
	await expect(page.getByRole("heading", { name })).toBeVisible();

	// Client-side navigation keeps this document, so the observer sees every
	// frame between the click and /people.
	await page.evaluate(() => {
		const w = window as unknown as { sawNotFound: boolean };
		w.sawNotFound = false;
		new MutationObserver(() => {
			if (document.body.innerText.includes("Nothing here")) w.sawNotFound = true;
		}).observe(document.body, { subtree: true, childList: true, characterData: true });
	});
	await page.getByRole("button", { name: `Delete ${name}` }).click();

	await page.waitForURL("**/people");
	await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
	// A role query: the person page stays mounted but hidden after the route
	// change (Next keeps the previous page in a hidden Activity).
	await expect(page.getByRole("link", { name })).toHaveCount(0);
	expect(
		await page.evaluate(() => (window as unknown as { sawNotFound: boolean }).sawNotFound),
	).toBe(false);
});
