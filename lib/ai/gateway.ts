import "server-only";
import { createGateway } from "@ai-sdk/gateway";
import { env, isAiConfigured } from "@/lib/env";

// ─────────────────────────────────────────────────────────────────────────
// The single touch point for the Vercel AI Gateway (docs/adr/0004). One
// AI_GATEWAY_API_KEY, models as plain gateway strings from env() — no provider
// SDKs or keys. Callers guard with isAiConfigured() and degrade to typed
// fallbacks; nothing here throws into the capture path.
// ─────────────────────────────────────────────────────────────────────────

export { isAiConfigured };

// The Vercel project the gateway files each request under. An API key is
// team-scoped, so without this header the dashboard lists every call as
// "No Project". The SDK only sends it when VERCEL_PROJECT_ID is set, which
// is never true locally (dev server, bun run eval:parser). Not a secret —
// it is the id in .vercel/project.json.
const PROJECT_ID = "prj_jqDALikzyU3TNet3v0pvbCqOoBAb";

function gateway() {
	return createGateway({
		apiKey: env().AI_GATEWAY_API_KEY,
		headers: { "ai-o11y-project-id": process.env.VERCEL_PROJECT_ID ?? PROJECT_ID },
	});
}

/** The gateway-routed parser model (env.PARSER_MODEL). */
export function parserModel() {
	return gateway()(env().PARSER_MODEL);
}

/** The gateway-routed chat model (env.CHAT_MODEL). */
export function chatModel() {
	return gateway()(env().CHAT_MODEL);
}
