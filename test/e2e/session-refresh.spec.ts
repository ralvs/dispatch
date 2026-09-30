import { expect, type Page, test } from "@playwright/test";
import { combineChunks, createChunks, stringFromBase64URL, stringToBase64URL } from "@supabase/ssr";
import { OWNER_EMAIL, OWNER_PASSWORD } from "../integration/stack";

/**
 * The browser refreshes an expired session by itself (docs/adr/0025, 0032,
 * 0067). /sign-in sits outside the proxy matcher, so when it lands on an
 * expired session nothing on the server can refresh it: the browser auth client
 * has to call /token, write cookies the server accepts, and send the owner on
 * to /today without asking for a password.
 */

// Its own session: rotating the shared setup session would revoke it for
// every other spec running in parallel.
test.use({ storageState: { cookies: [], origins: [] } });

const BASE64_PREFIX = "base64-";

async function signIn(page: Page) {
	await page.goto("/sign-in");
	await page.getByLabel("Email").fill(OWNER_EMAIL);
	await page.getByLabel("Password").fill(OWNER_PASSWORD);
	await page.locator('button[type="submit"]').click();
	await page.waitForURL("**/today");
}

type StoredSession = { expires_at: number; refresh_token: string };

async function readSession(page: Page): Promise<{ key: string; session: StoredSession }> {
	const cookies = await page.context().cookies();
	const first = cookies.find((c) => /^sb-.+-auth-token(\.0)?$/.test(c.name));
	if (!first) throw new Error("No auth cookie after sign-in");
	const key = first.name.replace(/\.0$/, "");
	const raw = await combineChunks(key, (name) => cookies.find((c) => c.name === name)?.value);
	if (!raw?.startsWith(BASE64_PREFIX)) throw new Error("Auth cookie is not base64-encoded");
	const session = JSON.parse(stringFromBase64URL(raw.slice(BASE64_PREFIX.length)));
	return { key, session };
}

/** Rewrites the stored session in place, the way a stale browser would hold it. */
async function writeSession(page: Page, key: string, session: StoredSession) {
	const context = page.context();
	const url = new URL(page.url()).origin;
	const stale = (await context.cookies()).filter((c) => c.name.startsWith(key));
	await context.clearCookies({ name: new RegExp(`^${key}`) });
	const value = BASE64_PREFIX + stringToBase64URL(JSON.stringify(session));
	await context.addCookies(
		createChunks(key, value).map((chunk) => ({ name: chunk.name, value: chunk.value, url })),
	);
	expect(stale.length).toBeGreaterThan(0);
}

test("an expired session on /sign-in refreshes in the browser and lands on /today", async ({
	page,
}) => {
	await signIn(page);
	const { key, session } = await readSession(page);

	await writeSession(page, key, {
		...session,
		expires_at: Math.floor(Date.now() / 1000) - 60,
	});

	const refresh = page.waitForRequest(
		(req) => req.url().includes("/auth/v1/token") && req.url().includes("refresh_token"),
	);
	await page.goto("/sign-in");
	await refresh;
	await page.waitForURL("**/today");

	const after = await readSession(page);
	expect(after.session.refresh_token, "the refresh token rotated").not.toBe(session.refresh_token);
	expect(after.session.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
	await expect(page.getByLabel("Password")).toHaveCount(0);
});
