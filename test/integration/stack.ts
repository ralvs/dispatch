import { execFileSync } from "node:child_process";

/**
 * The local Supabase stack the integration layer runs against (docs/adr/0063).
 * `global-setup.ts` reads it from `supabase status` once per run and hands it
 * to the test files through Vitest's provide/inject.
 */
export type LocalStack = {
	apiUrl: string;
	dbUrl: string;
	publishableKey: string;
	secretKey: string;
};

declare module "vitest" {
	export interface ProvidedContext {
		supabase: LocalStack;
	}
}

// Mirrors supabase/seed.sql. Local-only credentials; they open nothing hosted.
export const OWNER_USER_ID = "0b0e0000-0000-4000-8000-000000000001";
export const OWNER_EMAIL = "owner@dispatch.test";
export const OWNER_PASSWORD = "dispatch-local-owner";

/**
 * Read the local stack from `supabase status`, refusing anything that is not on
 * this machine. Shared by the integration global setup and the e2e config.
 */
export function readLocalStack(): LocalStack {
	let raw: string;
	try {
		raw = execFileSync("supabase", ["status", "-o", "json"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
	} catch (error) {
		throw new Error(
			"The local Supabase stack is not running. Start it with `supabase start` (needs Docker).",
			{ cause: error },
		);
	}

	const status = JSON.parse(raw) as Record<string, string | undefined>;
	const stack = {
		apiUrl: status.API_URL,
		dbUrl: status.DB_URL,
		publishableKey: status.PUBLISHABLE_KEY,
		secretKey: status.SECRET_KEY,
	};
	for (const [key, value] of Object.entries(stack)) {
		if (!value) throw new Error(`\`supabase status\` did not report ${key}.`);
	}

	// The whole layer truncates tables before every test. It must never be able
	// to reach the hosted project, whatever the shell or .env.local says.
	for (const url of [stack.apiUrl, stack.dbUrl] as string[]) {
		const host = new URL(url).hostname;
		if (host !== "127.0.0.1" && host !== "localhost") {
			throw new Error(`Refusing to run tests against a non-local host: ${host}`);
		}
	}
	return stack as LocalStack;
}
