/**
 * One-shot OAuth helper for Google Calendar pull (docs/adr/0018).
 *
 * Scope: calendar.readonly ONLY — never request Gmail or other APIs.
 *
 * Prerequisites:
 *   1. GCP project with Calendar API enabled
 *   2. OAuth client (Desktop app recommended) → client id + secret
 *   3. While app is in Testing mode, add your Engine account as a test user
 *
 * Usage:
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... bun scripts/google-calendar-auth.ts
 *
 * Prints GOOGLE_REFRESH_TOKEN=... to paste into .env / Vercel. Never commit tokens.
 */

import { createServer } from "node:http";
import { parse as parseUrl } from "node:url";

const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const REDIRECT_PORT = 8765;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/oauth2callback`;

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
	console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the environment.");
	process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPE);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

console.log("\nGoogle Calendar OAuth (calendar.readonly only)\n");
console.log("1. Open this URL in a browser signed into your Engine account:\n");
console.log(authUrl.toString());
console.log(`\n2. Waiting for redirect on ${REDIRECT_URI} …\n`);

const server = createServer(async (req, res) => {
	const parsed = parseUrl(req.url ?? "", true);
	if (parsed.pathname !== "/oauth2callback") {
		res.writeHead(404);
		res.end("Not found");
		return;
	}

	const code = typeof parsed.query.code === "string" ? parsed.query.code : null;
	const err = typeof parsed.query.error === "string" ? parsed.query.error : null;

	if (err || !code) {
		res.writeHead(400, { "Content-Type": "text/plain" });
		res.end(`OAuth failed: ${err ?? "missing code"}`);
		console.error("OAuth failed:", err ?? "missing code");
		server.close();
		process.exit(1);
	}

	try {
		const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				code,
				client_id: clientId,
				client_secret: clientSecret,
				redirect_uri: REDIRECT_URI,
				grant_type: "authorization_code",
			}),
		});
		const json = (await tokenRes.json()) as {
			refresh_token?: string;
			access_token?: string;
			scope?: string;
			error?: string;
			error_description?: string;
		};

		if (!tokenRes.ok) {
			throw new Error(json.error_description ?? json.error ?? `HTTP ${tokenRes.status}`);
		}

		if (json.scope && !json.scope.includes("calendar.readonly")) {
			console.warn("Warning: granted scope did not include calendar.readonly:", json.scope);
		}

		res.writeHead(200, { "Content-Type": "text/plain" });
		res.end("OK — you can close this tab and return to the terminal.");

		console.log("Success. Add these to .env / Vercel:\n");
		console.log(`GOOGLE_CLIENT_ID=${clientId}`);
		console.log(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
		if (json.refresh_token) {
			console.log(`GOOGLE_REFRESH_TOKEN=${json.refresh_token}`);
		} else {
			console.error(
				"No refresh_token in response. Revoke prior grants at",
				"https://myaccount.google.com/permissions and re-run with prompt=consent.",
			);
		}
		console.log("");
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		res.writeHead(500, { "Content-Type": "text/plain" });
		res.end(`Token exchange failed: ${message}`);
		console.error("Token exchange failed:", message);
		server.close();
		process.exit(1);
	}

	server.close();
	process.exit(0);
});

server.listen(REDIRECT_PORT, "127.0.0.1");
