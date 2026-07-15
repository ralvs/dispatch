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

/** The gateway-routed parser model (env.PARSER_MODEL). */
export function parserModel() {
	const gw = createGateway({ apiKey: env().AI_GATEWAY_API_KEY });
	return gw(env().PARSER_MODEL);
}
