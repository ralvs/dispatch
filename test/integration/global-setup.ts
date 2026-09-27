import postgres from "postgres";
import type { TestProject } from "vitest/node";
import { ensureBaseline } from "./db";
import { readLocalStack } from "./stack";

/**
 * Once per `bun run test:integration`: find the local stack, refuse anything
 * that is not on this machine, and make sure the reset baseline exists.
 */
export default async function setup(project: TestProject) {
	const stack = readLocalStack();
	project.provide("supabase", stack);

	const sql = postgres(stack.dbUrl, { max: 1, onnotice: () => {} });
	try {
		await ensureBaseline(sql);
	} finally {
		await sql.end();
	}
}
