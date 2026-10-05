import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test as setup } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { OWNER_EMAIL, OWNER_PASSWORD, readLocalStack } from "../integration/stack";
import { AUTH_FILE, SEEDED_IDS_FILE, type SeededIds } from "./paths";

// Sign in once through the real form and hand the session to every test.
setup("sign in as the seeded owner", async ({ page }) => {
	await page.goto("/sign-in");
	await page.getByLabel("Email").fill(OWNER_EMAIL);
	await page.getByLabel("Password").fill(OWNER_PASSWORD);
	await page.locator('button[type="submit"]').click();
	await page.waitForURL("**/today");
	mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
	await page.context().storageState({ path: AUTH_FILE });
});

// Dynamic routes need a row to open. The seed has none, so find-or-create one
// per table with the service client — idempotent across runs.
setup("seed a row for every dynamic route", async () => {
	const stack = readLocalStack();
	const sb = createClient(stack.apiUrl, stack.secretKey, {
		auth: { persistSession: false, autoRefreshToken: false },
	});

	async function findOrCreate(table: string, row: Record<string, string>): Promise<string> {
		const found = await sb.from(table).select("id").match(row).limit(1).maybeSingle();
		if (found.error) throw new Error(`${table}: ${found.error.message}`);
		if (found.data) return found.data.id as string;
		const created = await sb.from(table).insert([row]).select("id").single();
		if (created.error) throw new Error(`${table}: ${created.error.message}`);
		return created.data.id as string;
	}

	const domainId = await findOrCreate("stewardship_domains", { name: "E2E Domain" });
	const projectId = await findOrCreate("projects", { name: "E2E Project", domain_id: domainId });
	const ids: SeededIds = {
		notes: await findOrCreate("notes", { title: "E2E note", body: "Seeded by the e2e setup." }),
		people: await findOrCreate("people", { name: "E2E Person" }),
		projects: projectId,
		tasks: await findOrCreate("tasks", {
			title: "E2E task",
			domain_id: domainId,
			project_id: projectId,
		}),
	};
	mkdirSync(path.dirname(SEEDED_IDS_FILE), { recursive: true });
	writeFileSync(SEEDED_IDS_FILE, JSON.stringify(ids));
});
