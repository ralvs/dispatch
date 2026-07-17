import { NextResponse } from "next/server";
import { z } from "zod";
import { ownerRoute } from "@/lib/auth";
import { isPushConfigured } from "@/lib/env";
import { deletePushSubscription, savePushSubscription } from "@/lib/services/push";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────
// Session-authed subscription management for Web Push (ADR-0005). Writes go
// through the service-role client because push_subscriptions has RLS enabled
// with no policies (only service-role can touch it) — requireOwner() below is
// what actually gates access here, not RLS.
// ─────────────────────────────────────────────────────────────────────────

const SubscriptionSchema = z.object({
	endpoint: z.string().url(),
	keys: z.object({
		p256dh: z.string().min(1),
		auth: z.string().min(1),
	}),
});

const DeleteSchema = z.object({
	endpoint: z.string().url(),
});

export const POST = ownerRoute(async (request) => {
	if (!isPushConfigured()) {
		return NextResponse.json({ error: "push_not_configured" }, { status: 503 });
	}

	const json = await request.json().catch(() => null);
	const parsed = SubscriptionSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "invalid_request" }, { status: 400 });
	}

	await savePushSubscription(createAdminClient(), parsed.data);
	return NextResponse.json({ ok: true }, { status: 201 });
});

export const DELETE = ownerRoute(async (request) => {
	if (!isPushConfigured()) {
		return NextResponse.json({ error: "push_not_configured" }, { status: 503 });
	}

	const json = await request.json().catch(() => null);
	const parsed = DeleteSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "invalid_request" }, { status: 400 });
	}

	await deletePushSubscription(createAdminClient(), parsed.data.endpoint);
	return NextResponse.json({ ok: true }, { status: 200 });
});
