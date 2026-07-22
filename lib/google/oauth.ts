import "server-only";
import { env } from "@/lib/env";

// ─────────────────────────────────────────────────────────────────────────
// Google OAuth helpers (docs/adr/0018). Scope is calendar.readonly ONLY —
// never Gmail or other APIs. Client id/secret live in env (personal GCP
// project); the owner signs in as their Engine Workspace account.
// ─────────────────────────────────────────────────────────────────────────

export const GOOGLE_CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

/** CSRF cookie set by oauth/start and checked by oauth/callback. */
export const GOOGLE_OAUTH_STATE_COOKIE = "gcal_oauth_state";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_LIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList";

export function googleOAuthRedirectUri(origin: string): string {
	return `${origin.replace(/\/$/, "")}/api/google/oauth/callback`;
}

export function buildGoogleAuthUrl(opts: { origin: string; state: string }): string {
	const e = env();
	if (!e.GOOGLE_CLIENT_ID) {
		throw new Error("GOOGLE_CLIENT_ID is not configured");
	}
	const url = new URL(AUTH_URL);
	url.searchParams.set("client_id", e.GOOGLE_CLIENT_ID);
	url.searchParams.set("redirect_uri", googleOAuthRedirectUri(opts.origin));
	url.searchParams.set("response_type", "code");
	url.searchParams.set("scope", GOOGLE_CALENDAR_READONLY_SCOPE);
	url.searchParams.set("access_type", "offline");
	url.searchParams.set("prompt", "consent");
	url.searchParams.set("include_granted_scopes", "false");
	url.searchParams.set("state", opts.state);
	return url.toString();
}

export type GoogleTokenResponse = {
	access_token: string;
	refresh_token?: string;
	expires_in?: number;
	scope?: string;
	token_type?: string;
};

export async function exchangeCodeForTokens(opts: {
	code: string;
	origin: string;
}): Promise<GoogleTokenResponse> {
	const e = env();
	if (!e.GOOGLE_CLIENT_ID || !e.GOOGLE_CLIENT_SECRET) {
		throw new Error("Google OAuth client is not configured");
	}
	const res = await fetch(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			code: opts.code,
			client_id: e.GOOGLE_CLIENT_ID,
			client_secret: e.GOOGLE_CLIENT_SECRET,
			redirect_uri: googleOAuthRedirectUri(opts.origin),
			grant_type: "authorization_code",
		}),
	});
	const json = (await res.json()) as GoogleTokenResponse & {
		error?: string;
		error_description?: string;
	};
	if (!res.ok) {
		throw new Error(json.error_description ?? json.error ?? `token exchange ${res.status}`);
	}
	if (json.scope && !json.scope.includes("calendar.readonly")) {
		throw new Error(`Unexpected OAuth scope (calendar.readonly required): ${json.scope}`);
	}
	return json;
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
	const e = env();
	if (!e.GOOGLE_CLIENT_ID || !e.GOOGLE_CLIENT_SECRET) {
		throw new Error("Google OAuth client is not configured");
	}
	const res = await fetch(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: e.GOOGLE_CLIENT_ID,
			client_secret: e.GOOGLE_CLIENT_SECRET,
			refresh_token: refreshToken,
			grant_type: "refresh_token",
		}),
	});
	const json = (await res.json()) as {
		access_token?: string;
		error?: string;
		error_description?: string;
	};
	if (!res.ok || !json.access_token) {
		throw new Error(
			json.error_description ?? json.error ?? `Google token refresh failed: ${res.status}`,
		);
	}
	return json.access_token;
}

/**
 * Best-effort account label for Settings — primary calendar id (usually the
 * Workspace email). Uses Calendar API only (no userinfo / Gmail scopes).
 */
export async function fetchPrimaryCalendarLabel(accessToken: string): Promise<string | null> {
	try {
		const url = new URL(CAL_LIST_URL);
		url.searchParams.set("minAccessRole", "reader");
		url.searchParams.set("maxResults", "50");
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		if (!res.ok) return null;
		const json = (await res.json()) as {
			items?: { id?: string; primary?: boolean; summary?: string }[];
		};
		const primary = json.items?.find((i) => i.primary) ?? json.items?.[0];
		return primary?.id ?? primary?.summary ?? null;
	} catch {
		return null;
	}
}
