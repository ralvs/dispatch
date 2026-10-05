import { describe, expect, it } from "vitest";
import { bearerChallenge, originOf } from "@/lib/mcp-origin";

describe("originOf", () => {
	it("reads the request URL when no proxy forwarded it", () => {
		expect(originOf(new Request("http://localhost:3000/api/mcp"))).toBe("http://localhost:3000");
	});

	it("prefers the forwarded host and protocol, as Vercel sends them", () => {
		const req = new Request("http://internal:3000/api/mcp", {
			headers: { "x-forwarded-host": "dispatch.alves.id", "x-forwarded-proto": "https" },
		});
		expect(originOf(req)).toBe("https://dispatch.alves.id");
	});

	it("falls back to https when the forwarded protocol is not http or https", () => {
		const req = new Request("http://internal:3000/api/mcp", {
			headers: { "x-forwarded-host": "dispatch.alves.id", "x-forwarded-proto": "javascript" },
		});
		expect(originOf(req)).toBe("https://dispatch.alves.id");
	});
});

describe("bearerChallenge", () => {
	it("points at the discovery document on the same origin", () => {
		expect(bearerChallenge("https://dispatch.alves.id")).toBe(
			'Bearer resource_metadata="https://dispatch.alves.id/.well-known/oauth-protected-resource"',
		);
	});
});
