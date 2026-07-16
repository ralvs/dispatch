import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { env, isPushConfigured } from "@/lib/env";
import { unwrap } from "@/lib/services/errors";

// ─────────────────────────────────────────────────────────────────────────
// Web Push delivery (ADR-0005). This is the service-role-only counterpart to
// the notification ledger (lib/services/notifications.ts): the ledger is the
// record of what happened, this is the (best-effort) delivery of that record
// to the browser. push_subscriptions has RLS enabled with NO policies, so
// only a service-role client (createAdminClient()) can read/write it.
// ─────────────────────────────────────────────────────────────────────────

export type PushKeys = { p256dh: string; auth: string };
export type PushSubscriptionInput = { endpoint: string; keys: PushKeys };

type PushSubscriptionRow = {
	id: string;
	endpoint: string;
	keys: PushKeys;
	created_at: string;
};

export type PushPayload = { title: string; body?: string; url?: string };

let vapidConfigured = false;

/** Configures web-push's VAPID details once, lazily, on first real send. */
function ensureVapidConfigured(): void {
	if (vapidConfigured) return;
	const e = env();
	webpush.setVapidDetails(
		e.VAPID_SUBJECT,
		e.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
		e.VAPID_PRIVATE_KEY as string,
	);
	vapidConfigured = true;
}

/** Upsert a subscription by endpoint (re-subscribing updates its keys). */
export async function savePushSubscription(
	sb: SupabaseClient,
	sub: PushSubscriptionInput,
): Promise<void> {
	unwrap(
		await sb
			.from("push_subscriptions")
			.upsert({ endpoint: sub.endpoint, keys: sub.keys }, { onConflict: "endpoint" }),
	);
}

export async function deletePushSubscription(sb: SupabaseClient, endpoint: string): Promise<void> {
	unwrap(await sb.from("push_subscriptions").delete().eq("endpoint", endpoint));
}

/**
 * Send `payload` to every stored subscription. No-ops when VAPID isn't
 * configured (single-user app with no push set up yet). Never throws for an
 * individual send failure — a dead subscription (404/410) is pruned from the
 * table; any other failure is simply not counted as sent, and the loop
 * continues.
 */
export async function sendPushToAll(
	sb: SupabaseClient,
	payload: PushPayload,
): Promise<{ sent: number; pruned: number }> {
	if (!isPushConfigured()) return { sent: 0, pruned: 0 };
	ensureVapidConfigured();

	const rows = unwrap(
		await sb.from("push_subscriptions").select("id, endpoint, keys, created_at"),
	) as PushSubscriptionRow[] | null;
	if (!rows || rows.length === 0) return { sent: 0, pruned: 0 };

	let sent = 0;
	let pruned = 0;
	const body = JSON.stringify(payload);

	for (const row of rows) {
		try {
			await webpush.sendNotification({ endpoint: row.endpoint, keys: row.keys }, body);
			sent += 1;
		} catch (err) {
			const statusCode = (err as { statusCode?: number } | null)?.statusCode;
			if (statusCode === 404 || statusCode === 410) {
				// Prune is itself best-effort: a failed delete must not abort the
				// remaining sends — the dead row just gets retried next time.
				try {
					await deletePushSubscription(sb, row.endpoint);
					pruned += 1;
				} catch {}
			}
			// Any other failure: skip this subscription, keep going.
		}
	}

	return { sent, pruned };
}
