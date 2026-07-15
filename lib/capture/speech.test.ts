import { describe, expect, it } from "vitest";
import {
	getSpeechRecognitionCtor,
	isSpeechRecognitionSupported,
	joinSpoken,
	nextLang,
	type SpeechRecognitionCtor,
} from "@/lib/capture/speech";

const FakeCtor = class {} as unknown as SpeechRecognitionCtor;
const WebkitCtor = class {} as unknown as SpeechRecognitionCtor;

describe("nextLang", () => {
	it("toggles pt-BR to en-US and back", () => {
		expect(nextLang("pt-BR")).toBe("en-US");
		expect(nextLang("en-US")).toBe("pt-BR");
	});
});

describe("joinSpoken", () => {
	it("joins two fragments with a single space", () => {
		expect(joinSpoken("call the", "doctor")).toBe("call the doctor");
	});

	it("returns the non-empty side when the other is blank", () => {
		expect(joinSpoken("hello", "")).toBe("hello");
		expect(joinSpoken("", "world")).toBe("world");
		expect(joinSpoken("  ", "world")).toBe("world");
	});

	it("trims surrounding whitespace", () => {
		expect(joinSpoken("  a  ", "  b  ")).toBe("a b");
	});
});

describe("getSpeechRecognitionCtor", () => {
	it("prefers the standard constructor", () => {
		expect(getSpeechRecognitionCtor({ SpeechRecognition: FakeCtor })).toBe(FakeCtor);
	});

	it("falls back to the webkit-prefixed constructor", () => {
		expect(getSpeechRecognitionCtor({ webkitSpeechRecognition: WebkitCtor })).toBe(WebkitCtor);
	});

	it("returns null when neither is present", () => {
		expect(getSpeechRecognitionCtor({})).toBeNull();
	});
});

describe("isSpeechRecognitionSupported", () => {
	it("is true when a constructor exists", () => {
		expect(isSpeechRecognitionSupported({ webkitSpeechRecognition: WebkitCtor })).toBe(true);
	});

	it("is false when unsupported", () => {
		expect(isSpeechRecognitionSupported({})).toBe(false);
	});
});
