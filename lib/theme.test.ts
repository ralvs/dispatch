import { describe, expect, it } from "vitest";
import { isThemePref, resolveTheme } from "./theme";

describe("resolveTheme", () => {
	it("keeps a forced pick whatever the OS says", () => {
		expect(resolveTheme("light", true)).toBe("light");
		expect(resolveTheme("dark", false)).toBe("dark");
	});

	it("follows the OS under system", () => {
		expect(resolveTheme("system", true)).toBe("dark");
		expect(resolveTheme("system", false)).toBe("light");
	});
});

describe("isThemePref", () => {
	it("accepts the three picks", () => {
		expect(isThemePref("light")).toBe(true);
		expect(isThemePref("dark")).toBe(true);
		expect(isThemePref("system")).toBe(true);
	});

	it("rejects anything else", () => {
		expect(isThemePref("auto")).toBe(false);
		expect(isThemePref("")).toBe(false);
		expect(isThemePref(undefined)).toBe(false);
		expect(isThemePref(1)).toBe(false);
	});
});
