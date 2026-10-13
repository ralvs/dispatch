import { afterAll, beforeEach, inject } from "vitest";
import { closeDatabase, resetDatabase } from "./db";
import { OWNER_USER_ID } from "./stack";

// Point lib/env.ts at the local stack for any code that reads it (the admin
// client, requireOwner's owner check) — never at the hosted project.
const stack = inject("supabase");
process.env.NEXT_PUBLIC_SUPABASE_URL = stack.apiUrl;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = stack.publishableKey;
process.env.SUPABASE_SECRET_KEY = stack.secretKey;
process.env.OWNER_USER_ID = OWNER_USER_ID;

// The AI gateway is always faked in tests. With no key, lib/ai degrades to its
// typed fallbacks, and a test that needs a parse injects
// test/fakes/parser-model.ts.
delete process.env.AI_GATEWAY_API_KEY;

// Storage is always faked too (docs/adr/0088). With no R2 credentials, a test
// that forgets to inject test/fakes/storage.ts throws "R2 is not configured"
// instead of reaching the bucket.
delete process.env.R2_ACCOUNT_ID;
delete process.env.R2_ACCESS_KEY_ID;
delete process.env.R2_SECRET_ACCESS_KEY;
delete process.env.R2_BUCKET;

beforeEach(async () => {
	await resetDatabase();
});

afterAll(async () => {
	await closeDatabase();
});
