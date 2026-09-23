import { execFileSync } from "node:child_process";
import postgres from "postgres";
import type { TestProject } from "vitest/node";
import { ensureBaseline } from "./db";
import type { LocalStack } from "./stack";

/**
 * Once per `bun run test:integration`: find the local stack, refuse anything
 * that is not on this machine, and make sure the reset baseline exists.
 */
export default async function setup(project: TestProject) {
	const stack = readStack();
	project.provide("supabase", stack);

	const sql = postgres(stack.dbUrl, { max: 1, onnotice: () => {} });
	try {
		await ensureBaseline(sql);
	} finally {
		await sql.end();
	}
}

function readStack(): LocalStack {
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
			throw new Error(`Refusing to run integration tests against a non-local host: ${host}`);
		}
	}
	return stack as LocalStack;
}
