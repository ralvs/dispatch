import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { SEEDED_IDS_FILE, type SeededIds } from "./paths";
import { authedRoutes } from "./routes";

/**
 * Skeleton smoke (#10, docs/adr/0062 Decision 4). A hydration mismatch in the
 * prerendered shell does not throw anything the user sees: the page just sits
 * on its `loading.tsx` forever, and the production build only logs minified
 * React error #418. Every authed route must get past its skeleton, with no
 * hydration error on the console.
 */

// Every route-level skeleton and in-page Suspense fallback announces itself
// with a `role="status"` whose text starts with "Loading" (see
// components/ui/page-skeleton.tsx and the loading.tsx files).
const SKELETON = '[role="status"]';
const SKELETON_TEXT = /^\s*Loading/;
const THRESHOLD_MS = 15_000;

const HYDRATION = /#418|#423|#425|hydrat/i;

function resolve(route: string): string {
	if (!route.includes("[")) return route;
	const ids = JSON.parse(readFileSync(SEEDED_IDS_FILE, "utf8")) as SeededIds;
	return route.replace(/^\/([^/]+)\/\[[^\]]+\]/, (_, table: string) => {
		const id = ids[table];
		if (!id) throw new Error(`No seeded id for ${route} — add one in auth.setup.ts.`);
		return `/${table}/${id}`;
	});
}

for (const route of authedRoutes()) {
	test(`${route} loads past its skeleton`, async ({ page }) => {
		const errors: string[] = [];
		page.on("console", (msg) => {
			if (msg.type() === "error" && HYDRATION.test(msg.text())) errors.push(msg.text());
		});
		page.on("pageerror", (error) => {
			if (HYDRATION.test(`${error.message}\n${error.stack ?? ""}`)) errors.push(error.message);
		});
		// The gateway is faked (AGENTS.md → Testing): no page load may reach it.
		const gatewayCalls: string[] = [];
		await page.route(/ai-gateway\.vercel\.sh/, (r) => {
			gatewayCalls.push(r.request().url());
			return r.abort();
		});

		const url = resolve(route);
		await page.goto(url);
		expect(new URL(page.url()).pathname, "redirected away — is the session valid?").toBe(url);

		await expect(
			page.locator(SKELETON).filter({ hasText: SKELETON_TEXT }),
			`${url} is still on its skeleton after ${THRESHOLD_MS}ms`,
		).toHaveCount(0, { timeout: THRESHOLD_MS });

		expect(errors, "hydration errors on the console").toEqual([]);
		expect(gatewayCalls, "AI gateway calls from the browser").toEqual([]);
	});
}
