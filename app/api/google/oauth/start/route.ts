import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { isGoogleOAuthConfigured } from "@/lib/env";
import { buildGoogleAuthUrl, GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/google/oauth";

// Owner-only: redirect to Google consent (calendar.readonly). State cookie
// prevents CSRF on the callback.

export async function GET(request: Request) {
	const auth = await requireOwner();
	if (auth instanceof NextResponse) return auth;

	if (!isGoogleOAuthConfigured()) {
		return NextResponse.json({ error: "gcal_oauth_not_configured" }, { status: 503 });
	}

	const origin = new URL(request.url).origin;
	const state = randomBytes(24).toString("hex");
	const url = buildGoogleAuthUrl({ origin, state });

	const res = NextResponse.redirect(url);
	res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
		httpOnly: true,
		secure: origin.startsWith("https"),
		sameSite: "lax",
		path: "/",
		maxAge: 600,
	});
	return res;
}
