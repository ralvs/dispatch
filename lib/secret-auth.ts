import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────
// Shared-secret auth for the external HTTP surfaces (ingest, cron, widget —
// iron rule #2). Each surface has its own secret in env(); callers present it
// as `Authorization: Bearer <secret>`. Comparison is constant-time over
// fixed-length digests so neither length nor content leaks through timing.
// ─────────────────────────────────────────────────────────────────────────

/** Extract the bearer token from a request, or null if absent/malformed. */
export function bearerToken(request: Request): string | null {
	const header = request.headers.get("authorization");
	if (!header) return null;
	const match = /^Bearer\s+(.+)$/i.exec(header);
	return match ? match[1] : null;
}

/**
 * Timing-safe equality between a provided token and the expected secret.
 * Hashing both sides first makes the buffers fixed-length, so
 * `timingSafeEqual` applies regardless of input lengths.
 */
export function secretsMatch(provided: string, expected: string): boolean {
	const a = createHash("sha256").update(provided).digest();
	const b = createHash("sha256").update(expected).digest();
	return timingSafeEqual(a, b);
}

/**
 * True when the request carries the expected bearer secret. `expected` being
 * unset/empty always fails — an unconfigured surface must stay closed.
 */
export function isAuthorized(request: Request, expected: string | undefined): boolean {
	if (!expected) return false;
	const provided = bearerToken(request);
	return provided !== null && secretsMatch(provided, expected);
}
