import { describe, expect, it } from "vitest";
import { readCaptureIntent } from "@/lib/pwa/capture-intent";

describe("readCaptureIntent", () => {
	it("recognises the capture shortcut", () => {
		expect(readCaptureIntent("?capture=1")).toBe(true);
	});

	it("accepts the legacy voice value from older PWA installs", () => {
		expect(readCaptureIntent("?capture=voice")).toBe(true);
	});

	it("tolerates a missing leading '?' and extra params", () => {
		expect(readCaptureIntent("capture=1")).toBe(true);
		expect(readCaptureIntent("?foo=1&capture=1&bar=2")).toBe(true);
	});

	it("returns false for anything else", () => {
		expect(readCaptureIntent("")).toBe(false);
		expect(readCaptureIntent("?capture=")).toBe(false);
		expect(readCaptureIntent("?foo=1")).toBe(false);
	});
});
