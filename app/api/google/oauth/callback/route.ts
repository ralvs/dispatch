import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { isGoogleOAuthConfigured } from "@/lib/env";
import {
	exchangeCodeForTokens,
	fetchPrimaryCalendarLabel,
	GOOGLE_OAUTH_STATE_COOKIE,
} from "@/lib/google/oauth";
import { saveGoogleConnection } from "@/lib/services/google-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// OAuth redirect target. Owner session required; stores refresh_token via
// service role (google_sync_state has no RLS policies).

export async function GET(request: Request) {
	const auth = await requireOwner();
	if (auth instanceof NextResponse) {
		// No session on return — send to sign-in rather than raw 401 JSON.
		const signIn = new URL("/sign-in", request.url);
		return NextResponse.redirect(signIn);
	}

	if (!isGoogleOAuthConfigured()) {
		return NextResponse.redirect(
			new URL("/settings?gcal=error&reason=not_configured", request.url),
		);
	}

	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const oauthError = url.searchParams.get("error");

	const cookieStore = await cookies();
	const expectedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;

	const clearState = (res: NextResponse) => {
		res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
		return res;
	};

	if (oauthError) {
		return clearState(
			NextResponse.redirect(
				new URL(`/settings?gcal=error&reason=${encodeURIComponent(oauthError)}`, request.url),
			),
		);
	}

	if (!code || !state || !expectedState || state !== expectedState) {
		return clearState(
			NextResponse.redirect(new URL("/settings?gcal=error&reason=invalid_state", request.url)),
		);
	}

	try {
		const tokens = await exchangeCodeForTokens({
			code,
			origin: url.origin,
		});
		if (!tokens.refresh_token) {
			return clearState(
				NextResponse.redirect(new URL("/settings?gcal=error&reason=no_refresh_token", request.url)),
			);
		}

		const accountEmail = await fetchPrimaryCalendarLabel(tokens.access_token);
		const admin = createAdminClient();
		await saveGoogleConnection(admin, {
			refreshToken: tokens.refresh_token,
			accountEmail,
		});

		return clearState(NextResponse.redirect(new URL("/settings?gcal=connected", request.url)));
	} catch (err) {
		const message = err instanceof Error ? err.message : "token_exchange_failed";
		return clearState(
			NextResponse.redirect(
				new URL(
					`/settings?gcal=error&reason=${encodeURIComponent(message.slice(0, 120))}`,
					request.url,
				),
			),
		);
	}
}
