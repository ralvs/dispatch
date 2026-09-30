import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readLocalStack } from "../integration/stack";

/**
 * A write lands everywhere without a page render (#26). A task ticked on
 * /tasks shows ticked on /today after a client-side navigation, and Today's
 * open counter has moved. Both pages read the one entity store (lib/store).
 *
 * The task is created through the app, not inserted with the service client:
 * /tasks reads a cross-request cache that only an app write busts, and the
 * skeleton smoke running beside this test may already have filled it.
 */

const stack = readLocalStack();
const sb = createClient(stack.apiUrl, stack.secretKey, {
	auth: { persistSession: false, autoRefreshToken: false },
});

const title = `E2E tick ${Date.now()}`;

/** A zero count renders no row at all (today/counters.tsx), so absent reads as 0. */
async function openCount(page: Page): Promise<number> {
	const link = page
		.getByRole("navigation", { name: "Today at a glance" })
		.getByRole("link", { name: /open$/ });
	if ((await link.count()) === 0) return 0;
	const text = (await link.textContent()) ?? "";
	return Number(text.match(/\d+/)?.[0]);
}

test.afterAll(async () => {
	await sb.from("tasks").delete().eq("title", title);
});

test("a tick on /tasks shows on /today, and the counter moves", async ({ page }) => {
	await page.goto("/tasks");
	await page.getByRole("button", { name: "New task" }).click();
	await page.getByRole("dialog").getByLabel("Task title").fill(title);
	await page.getByRole("button", { name: "Today", exact: true }).click();
	await page
		.getByRole("dialog")
		.getByRole("combobox", { name: "Domain" })
		.selectOption({ label: "E2E Domain" });
	await page.getByRole("button", { name: "Add task" }).click();
	const complete = page.getByRole("checkbox", { name: `Complete "${title}"` });
	await expect(complete).toBeVisible();

	await page.getByRole("link", { name: "Today", exact: true }).first().click();
	await page.waitForURL("**/today");
	await expect(page.getByRole("checkbox", { name: `Complete "${title}"` })).toBeVisible();
	const before = await openCount(page);
	expect(before).toBeGreaterThan(0);

	await page.getByRole("link", { name: "Tasks", exact: true }).first().click();
	await page.waitForURL("**/tasks");
	// The drawn box sits over the native input (components/ui/checkbox.tsx), so
	// the click lands on it, the way a person's does.
	await complete.click({ force: true });
	await expect(page.getByRole("checkbox", { name: `Reopen "${title}"` })).toBeVisible();

	await page.getByRole("link", { name: "Today", exact: true }).first().click();
	await page.waitForURL("**/today");
	// ADR-0038: the day keeps what was finished on it, struck.
	await expect(page.getByRole("checkbox", { name: `Reopen "${title}"` })).toBeVisible();
	await expect.poll(() => openCount(page)).toBe(before - 1);
});

test("day navigation reads other days into the store and comes back", async ({ page }) => {
	await page.goto("/today");
	const nav = page.getByRole("navigation", { name: "Day navigation" });
	await nav.getByRole("button", { name: "Next day" }).click();
	await expect(page).toHaveURL(/\/today\?d=\d{4}-\d{2}-\d{2}$/);
	const tomorrow = new URL(page.url()).searchParams.get("d");

	await nav.getByRole("button", { name: "Previous day" }).click();
	await expect(page).toHaveURL(/\/today$/);
	// Back to a day the store already holds: no fetch, no dim.
	await nav.getByRole("button", { name: "Next day" }).click();
	await expect(page).toHaveURL(new RegExp(`d=${tomorrow}$`));
	await expect(page.locator("[data-pending]")).toHaveCount(0);
});
