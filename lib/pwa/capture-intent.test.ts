import { describe, expect, it } from "vitest";
import { readCaptureIntent } from "@/lib/pwa/capture-intent";

describe("readCaptureIntent", () => {
	it("recognises the voice capture shortcut", () => {
		expect(readCaptureIntent("?capture=voice")).toBe("voice");
	});

	it("tolerates a missing leading '?' and extra params", () => {
		expect(readCaptureIntent("capture=voice")).toBe("voice");
		expect(readCaptureIntent("?foo=1&capture=voice&bar=2")).toBe("voice");
	});

	it("returns null for anything else", () => {
		expect(readCaptureIntent("")).toBeNull();
		expect(readCaptureIntent("?capture=text")).toBeNull();
		expect(readCaptureIntent("?foo=1")).toBeNull();
	});
});
