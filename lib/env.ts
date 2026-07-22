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
	PARSER_MODEL: z.string().default("anthropic/claude-sonnet-5"),
	CHAT_MODEL: z.string().default("anthropic/claude-sonnet-5"),

	// External-surface secrets (Phase 7)
	INGEST_WEBHOOK_SECRET: z.string().min(20).optional(),
	CRON_SECRET: z.string().min(20).optional(),
	WIDGET_SECRET: z.string().min(20).optional(),

	// iCloud CalDAV (Phase 7)
	ICLOUD_USERNAME: z.string().optional(),
	ICLOUD_APP_PASSWORD: z.string().optional(),
	ICLOUD_CALENDAR_NAME: z.string().optional(),

	// Google Calendar OAuth app (docs/adr/0018) — personal GCP project is fine.
	// Refresh token lives in google_sync_state after Settings → Connect.
	GOOGLE_CLIENT_ID: z.string().optional(),
	GOOGLE_CLIENT_SECRET: z.string().optional(),

	// Web Push (Phase 7)
	NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
	VAPID_PRIVATE_KEY: z.string().optional(),
	VAPID_SUBJECT: z.string().default("mailto:renan@alves.id"),

	// Mem.ai import (Phase 9)
	MEM_API_KEY: z.string().optional(),
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

/** OAuth client credentials present (Connect button can work). */
export const isGoogleOAuthConfigured = () =>
	Boolean(env().GOOGLE_CLIENT_ID && env().GOOGLE_CLIENT_SECRET);

export const isPushConfigured = () =>
	Boolean(env().NEXT_PUBLIC_VAPID_PUBLIC_KEY && env().VAPID_PRIVATE_KEY);
