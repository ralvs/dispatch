import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// env() caches its parsed result in a module-level variable — reset modules
// and re-import fresh each test so env var changes actually take effect.
async function importEnv() {
	const mod = await import("@/lib/env");
	return mod.env;
}

describe("env", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("treats an empty-string OWNER_USER_ID as unset rather than an invalid uuid", async () => {
		vi.stubEnv("OWNER_USER_ID", "");
		const env = await importEnv();
		expect(env().OWNER_USER_ID).toBeUndefined();
	});

	it("throws on a genuinely invalid, non-empty OWNER_USER_ID", async () => {
		vi.stubEnv("OWNER_USER_ID", "not-a-uuid");
		const env = await importEnv();
		expect(() => env()).toThrow(/Invalid environment/);
	});

	it("accepts a valid OWNER_USER_ID", async () => {
		vi.stubEnv("OWNER_USER_ID", "84585218-bf6f-4077-b124-2c14db7f0b07");
		const env = await importEnv();
		expect(env().OWNER_USER_ID).toBe("84585218-bf6f-4077-b124-2c14db7f0b07");
	});
});
