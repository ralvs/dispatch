import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nowUtc } from "@/lib/dates";
import { unwrap } from "@/lib/services/errors";

// google_sync_state is service-role only (RLS, no policies). Callers must
// pass the admin client after requireOwner() has authorized the owner.

export type GoogleConnectionStatus = {
	connected: boolean;
	accountEmail: string | null;
	connectedAt: string | null;
	lastSyncedAt: string | null;
	lastResult: unknown;
};

export async function getGoogleConnectionStatus(
	admin: SupabaseClient,
): Promise<GoogleConnectionStatus> {
	const { data } = await admin
		.from("google_sync_state")
		.select("refresh_token, account_email, connected_at, last_synced_at, last_result")
		.eq("id", true)
		.maybeSingle();

	return {
		connected: Boolean(data?.refresh_token),
		accountEmail: data?.account_email ?? null,
		connectedAt: data?.connected_at ?? null,
		lastSyncedAt: data?.last_synced_at ?? null,
		lastResult: data?.last_result ?? null,
	};
}

export async function getGoogleRefreshToken(admin: SupabaseClient): Promise<string | null> {
	const { data } = await admin
		.from("google_sync_state")
		.select("refresh_token")
		.eq("id", true)
		.maybeSingle();
	return data?.refresh_token ?? null;
}

export async function saveGoogleConnection(
	admin: SupabaseClient,
	input: { refreshToken: string; accountEmail: string | null },
): Promise<void> {
	unwrap(
		await admin.from("google_sync_state").upsert(
			{
				id: true,
				refresh_token: input.refreshToken,
				account_email: input.accountEmail,
				connected_at: nowUtc(),
			},
			{ onConflict: "id" },
		),
	);
}

export async function clearGoogleConnection(admin: SupabaseClient): Promise<void> {
	unwrap(
		await admin.from("google_sync_state").upsert(
			{
				id: true,
				refresh_token: null,
				account_email: null,
				connected_at: null,
			},
			{ onConflict: "id" },
		),
	);
}
