import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readLocalStack } from "../integration/stack";

/**
 * A palette capture lands in the open page's lists with no page render
 * (docs/adr/0073). The AI gateway is off here, so the parser is unavailable and
 * the capture degrades to a needs_review note (iron rule #4) — which is still a
 * row the action hands back for the entity store to confirm.
 */

const stack = readLocalStack();
const sb = createClient(stack.apiUrl, stack.secretKey, {
	auth: { persistSession: false, autoRefreshToken: false },
});
const text = `E2E capture ${Date.now()}`;

test.afterAll(async () => {
	await sb.from("notes").delete().eq("body", text);
	await sb.from("captured_data").delete().eq("payload->>transcript", text);
});

test("a capture shows on /notes without a page render", async ({ page }) => {
	await page.goto("/notes");
	await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	await expect(page.getByText(text)).toHaveCount(0);

	// A server action that re-renders the page says so in this header
	// (next/dist/client/components/router-reducer/reducers/server-action-reducer.js).
	const revalidated: string[] = [];
	page.on("response", (res) => {
		const kind = res.headers()["x-action-revalidated"];
		if (res.request().method() === "POST" && kind && kind !== "0") revalidated.push(kind);
	});

	await page.keyboard.press("ControlOrMeta+j");
	const palette = page.getByRole("dialog", { name: "Capture" });
	await palette.getByLabel("Capture text").fill(text);
	await palette.getByRole("button", { name: "Capture", exact: true }).click();

	await expect(page.getByRole("link", { name: new RegExp(text) })).toBeVisible({
		timeout: 15_000,
	});
	expect(revalidated, "capture responses that re-rendered the page").toEqual([]);
});
