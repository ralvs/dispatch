import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inject } from "vitest";
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
	return createClient(stack.apiUrl, stack.secretKey, NO_PERSIST);
}

export function anonClient(): SupabaseClient {
	const stack = inject("supabase");
	return createClient(stack.apiUrl, stack.publishableKey, NO_PERSIST);
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
