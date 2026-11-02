import { createClient } from "@supabase/supabase-js";
import { inject } from "vitest";
import type { Database } from "@/lib/database";
import type { SupabaseClient } from "@/lib/supabase/types";
import { OWNER_EMAIL, OWNER_PASSWORD } from "./stack";

/**
 * The two clients services run under (iron rule #3: services take `sb` first).
 * `ownerClient` is what pages and actions hand them — RLS-scoped, signed in as
 * the seeded owner. `serviceClient` is what cron and capture hand them — the
 * secret key, RLS bypassed. `anonClient` has no session, for asserting that
 * RLS actually closes the door.
 */

const NO_PERSIST = { auth: { persistSession: false, autoRefreshToken: false } } as const;

export function serviceClient(): SupabaseClient {
	const stack = inject("supabase");
	return createClient<Database>(stack.apiUrl, stack.secretKey, NO_PERSIST);
}

export function anonClient(): SupabaseClient {
	const stack = inject("supabase");
	return createClient<Database>(stack.apiUrl, stack.publishableKey, NO_PERSIST);
}

/** Every request fails at the network — nothing listens on port 9. For the
 * paths that must survive a database that is down. */
export function unreachableClient(): SupabaseClient {
	return createClient<Database>("http://127.0.0.1:9", "unreachable", NO_PERSIST);
}

let owner: Promise<SupabaseClient> | undefined;

export function ownerClient(): Promise<SupabaseClient> {
	owner ??= (async () => {
		const sb = anonClient();
		const { error } = await sb.auth.signInWithPassword({
			email: OWNER_EMAIL,
			password: OWNER_PASSWORD,
		});
		if (error) {
			throw new Error(`Owner sign-in failed — is supabase/seed.sql applied? ${error.message}`);
		}
		return sb;
	})();
	return owner;
}

const STRANGER_EMAIL = "stranger@dispatch.test";
const STRANGER_PASSWORD = "dispatch-local-stranger";

let stranger: Promise<SupabaseClient> | undefined;

/** Signed in, but not the owner: what anyone gets if hosted sign-ups are ever
 * on (docs/adr/0095). Created on first use; auth.* survives the per-test reset. */
export function strangerClient(): Promise<SupabaseClient> {
	stranger ??= (async () => {
		const { error: createError } = await serviceClient().auth.admin.createUser({
			email: STRANGER_EMAIL,
			password: STRANGER_PASSWORD,
			email_confirm: true,
		});
		if (createError && createError.code !== "email_exists") {
			throw new Error(`Stranger sign-up failed: ${createError.message}`);
		}
		const sb = anonClient();
		const { error } = await sb.auth.signInWithPassword({
			email: STRANGER_EMAIL,
			password: STRANGER_PASSWORD,
		});
		if (error) throw new Error(`Stranger sign-in failed: ${error.message}`);
		return sb;
	})();
	return stranger;
}
