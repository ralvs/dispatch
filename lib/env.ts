import "server-only";
import { z } from "zod";

/**
 * Server env, validated lazily on first access. Integration vars are optional
 * so the app boots without them — features guard themselves with the
 * is*Configured() helpers and degrade cleanly (503 / "not configured") instead
 * of crashing at import time.
 */
const EnvSchema = z.object({
	// Supabase (Phase 1)
	NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
	NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
	SUPABASE_SECRET_KEY: z.string().min(1).optional(),
	OWNER_USER_ID: z.string().uuid().optional(),

	// AI Gateway (Phase 2)
	AI_GATEWAY_API_KEY: z.string().min(1).optional(),
	// Measured against the gateway on the same prompt: Haiku 4.5 dropped the
	// day word from "home: Ask refunds today" in 15 of 15 runs and invented a
	// project in 8 of 9, while Sonnet 5 got 10 of 11 captures fully right. A
	// capture is a few hundred tokens, so the cost difference is fractions of a
	// cent; the latency difference (~1.5s → ~3s) is hidden by the palette's
	// provisional receipt, which never blocks on the parse.
	// Then Sonnet 5 against Opus 5 (2026-09-19, 28 cases × 4 runs, both at
	// effort low): Sonnet 107/112 — broken JSON, a quote filed as a note, junk
	// projects — and Opus 112/112 at the same ~1.8s median. Effort is set on
	// every call in lib/ai/gateway.ts, not here.
	PARSER_MODEL: z.string().default("anthropic/claude-opus-5"),
	CHAT_MODEL: z.string().default("anthropic/claude-opus-5"),

	// External-surface secrets (Phase 7)
	CAPTURE_WEBHOOK_SECRET: z.string().min(20).optional(),
	CRON_SECRET: z.string().min(20).optional(),
	WIDGET_SECRET: z.string().min(20).optional(),
	// Mac EventKit bridge → POST /api/calendar/bridge (docs/adr/0018)
	CALENDAR_BRIDGE_SECRET: z.string().min(20).optional(),

	// iCloud CalDAV (Phase 7)
	ICLOUD_USERNAME: z.string().optional(),
	ICLOUD_APP_PASSWORD: z.string().optional(),
	ICLOUD_CALENDAR_NAME: z.string().optional(),

	// Web Push (Phase 7)
	NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
	VAPID_PRIVATE_KEY: z.string().optional(),
	VAPID_SUBJECT: z.string().default("mailto:renan@alves.id"),

	// Mem.ai import (Phase 9)
	MEM_API_KEY: z.string().optional(),

	// Cloudflare R2 — note attachments (docs/adr/0052). Optional like every
	// other integration: the app boots without them and the attachment
	// surfaces answer "not configured" rather than crashing at import.
	R2_ACCOUNT_ID: z.string().optional(),
	R2_ACCESS_KEY_ID: z.string().optional(),
	R2_SECRET_ACCESS_KEY: z.string().optional(),
	R2_BUCKET: z.string().optional(),
});

let cached: z.infer<typeof EnvSchema> | undefined;

export function env(): z.infer<typeof EnvSchema> {
	if (!cached) {
		// `.env` files declare unused vars as empty strings; treat "" as unset
		// so optional() semantics hold.
		const raw = Object.fromEntries(
			Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ""),
		);
		const parsed = EnvSchema.safeParse(raw);
		if (!parsed.success) {
			throw new Error(`Invalid environment: ${parsed.error.message}`);
		}
		cached = parsed.data;
	}
	return cached;
}

export const isSupabaseConfigured = () =>
	Boolean(
		env().NEXT_PUBLIC_SUPABASE_URL &&
			env().NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
			env().SUPABASE_SECRET_KEY,
	);

export const isAiConfigured = () => Boolean(env().AI_GATEWAY_API_KEY);

export const isCaldavConfigured = () =>
	Boolean(env().ICLOUD_USERNAME && env().ICLOUD_APP_PASSWORD && env().ICLOUD_CALENDAR_NAME);

export const isCalendarBridgeConfigured = () => Boolean(env().CALENDAR_BRIDGE_SECRET);

export const isPushConfigured = () =>
	Boolean(env().NEXT_PUBLIC_VAPID_PUBLIC_KEY && env().VAPID_PRIVATE_KEY);

export const isR2Configured = () =>
	Boolean(
		env().R2_ACCOUNT_ID && env().R2_ACCESS_KEY_ID && env().R2_SECRET_ACCESS_KEY && env().R2_BUCKET,
	);
