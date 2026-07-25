import { describe, expect, it } from "vitest";
import { bearerToken, isAuthorized, secretsMatch } from "@/lib/secret-auth";

const req = (auth?: string) =>
	new Request("https://example.test/api/capture", {
		headers: auth ? { authorization: auth } : {},
	});

describe("bearerToken", () => {
	it("extracts the token from a Bearer header, case-insensitively", () => {
		expect(bearerToken(req("Bearer abc123"))).toBe("abc123");
		expect(bearerToken(req("bearer abc123"))).toBe("abc123");
	});

	it("returns null when the header is missing or not Bearer", () => {
		expect(bearerToken(req())).toBeNull();
		expect(bearerToken(req("Basic abc123"))).toBeNull();
		expect(bearerToken(req("Bearer"))).toBeNull();
	});
});

describe("secretsMatch", () => {
	it("matches equal secrets and rejects different ones", () => {
		expect(secretsMatch("s3cret-value-long-enough", "s3cret-value-long-enough")).toBe(true);
		expect(secretsMatch("s3cret-value-long-enough", "other-value-long-enough!")).toBe(false);
	});

	it("rejects secrets of different lengths without throwing", () => {
		expect(secretsMatch("short", "a-much-longer-secret-value")).toBe(false);
	});
});

describe("isAuthorized", () => {
	const secret = "webhook-secret-of-sufficient-length";

	it("accepts a request presenting the expected secret", () => {
		expect(isAuthorized(req(`Bearer ${secret}`), secret)).toBe(true);
	});

	it("rejects wrong tokens and missing headers", () => {
		expect(isAuthorized(req("Bearer nope-nope-nope-nope-nope"), secret)).toBe(false);
		expect(isAuthorized(req(), secret)).toBe(false);
	});

	it("stays closed when the surface secret is unconfigured", () => {
		expect(isAuthorized(req(`Bearer ${secret}`), undefined)).toBe(false);
		expect(isAuthorized(req("Bearer "), "")).toBe(false);
	});
});
