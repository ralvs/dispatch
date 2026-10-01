import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readLocalStack } from "../integration/stack";

/**
 * A write from outside the app reaches an open Today with no page render (#4).
 * The calendar cron writes events without busting any client state; the
 * 5-minute pull brings them in. The browser clock is driven, the server's is
 * real.
 */

const stack = readLocalStack();
const sb = createClient(stack.apiUrl, stack.secretKey, {
	auth: { persistSession: false, autoRefreshToken: false },
});
const title = `E2E pulled event ${Date.now()}`;

test.afterAll(async () => {
	await sb.from("calendar_events").delete().eq("title", title);
});

test("an event synced while Today is open shows after the pull, without a page render", async ({
	page,
}) => {
	await page.clock.install();
	await page.goto("/today");
	await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	await expect(page.getByText(title)).toHaveCount(0);

	// What the caldav cron does: a row, and nothing else.
	const start = new Date(Date.now() + 60_000);
	const { error } = await sb.from("calendar_events").insert({
		title,
		start_at: start.toISOString(),
		end_at: new Date(start.getTime() + 30 * 60_000).toISOString(),
		source: "caldav",
	});
	expect(error).toBeNull();

	const renders: string[] = [];
	page.on("request", (req) => {
		// A render of Today itself.
		const url = new URL(req.url());
		const headers = req.headers();
		const rsc = headers.rsc === "1" || url.searchParams.has("_rsc");
		// A prefetch of the Today tab is not a render; router.refresh() sends none.
		const prefetch = Object.keys(headers).some(
			(h) => h.startsWith("next-router-prefetch") || h.startsWith("next-router-segment-prefetch"),
		);
		if (req.method() === "GET" && rsc && !prefetch && url.pathname === "/today") {
			renders.push(req.url());
		}
	});
	await page.clock.runFor(5 * 60_000 + 1_000);

	await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });
	expect(renders, "page renders during the pull").toEqual([]);
});

test("coming back to a tab hidden past five minutes pulls, without a page render", async ({
	page,
}) => {
	const returned = `${title} (return)`;
	await page.clock.install();
	await page.goto("/today");
	await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

	const setVisibility = (state: "hidden" | "visible") =>
		page.evaluate((s) => {
			Object.defineProperty(document, "visibilityState", { value: s, configurable: true });
			document.dispatchEvent(new Event("visibilitychange"));
		}, state);
	await setVisibility("hidden");
	const start = new Date(Date.now() + 60_000);
	await sb.from("calendar_events").insert({
		title: returned,
		start_at: start.toISOString(),
		end_at: new Date(start.getTime() + 30 * 60_000).toISOString(),
		source: "caldav",
	});
	// Hidden, the five-minute tick skips its pull.
	await page.clock.runFor(6 * 60_000);
	await expect(page.getByText(returned)).toHaveCount(0);

	const renders: string[] = [];
	page.on("request", (req) => {
		const url = new URL(req.url());
		const headers = req.headers();
		const rsc = headers.rsc === "1" || url.searchParams.has("_rsc");
		// A prefetch of the Today tab is not a render; router.refresh() sends none.
		const prefetch = Object.keys(headers).some(
			(h) => h.startsWith("next-router-prefetch") || h.startsWith("next-router-segment-prefetch"),
		);
		if (req.method() === "GET" && rsc && !prefetch && url.pathname === "/today") {
			renders.push(req.url());
		}
	});
	await setVisibility("visible");
	await expect(page.getByText(returned).first()).toBeVisible({ timeout: 15_000 });
	expect(renders, "page renders during the pull").toEqual([]);
	await sb.from("calendar_events").delete().eq("title", returned);
});
