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
// typed fallbacks, and a test that needs a parse mocks the module explicitly.
delete process.env.AI_GATEWAY_API_KEY;

beforeEach(async () => {
	await resetDatabase();
});

afterAll(async () => {
	await closeDatabase();
});
