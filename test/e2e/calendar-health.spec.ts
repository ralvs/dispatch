import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readLocalStack } from "../integration/stack";

/**
 * Today tells an empty day from a calendar that stopped syncing (#96,
 * ADR-0080). The work feed's sync-state row says its last success was days
 * ago; Today prints that under the headline, with no button — the Mac bridge
 * pushes, the server cannot pull. With the row fresh, the line is gone.
 */

const stack = readLocalStack();
const sb = createClient(stack.apiUrl, stack.secretKey, {
	auth: { persistSession: false, autoRefreshToken: false },
});

async function setWorkSyncedAt(at: Date) {
	const { error } = await sb.from("google_sync_state").upsert(
		{
			id: true,
			last_synced_at: at.toISOString(),
			last_result: { pulled: 0, removed: 0, via: "eventkit_bridge" },
		},
		{ onConflict: "id" },
	);
	expect(error).toBeNull();
}

// Serial: both tests move the same singleton row.
test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
	await sb.from("google_sync_state").delete().eq("id", true);
});

test("a work calendar with no sync for days says so on Today", async ({ page }) => {
	await setWorkSyncedAt(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000));
	await page.goto("/today");

	const line = page.getByRole("list", { name: "Calendar sync" });
	await expect(line).toContainText("Work calendar last synced");
	await expect(line).toContainText("The Mac bridge has not reported since.");
	await expect(line.getByRole("button")).toHaveCount(0);
});

test("a work calendar synced minutes ago says nothing", async ({ page }) => {
	await setWorkSyncedAt(new Date(Date.now() - 5 * 60 * 1000));
	await page.goto("/today");

	await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	await expect(page.getByRole("list", { name: "Calendar sync" })).toHaveCount(0);
});
