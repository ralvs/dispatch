import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createTerminalSettle,
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

describe("createTerminalSettle", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("settles on the first trigger and ignores the rest", () => {
		const onSettle = vi.fn();
		const terminal = createTerminalSettle(onSettle, 2000);
		terminal.settle();
		terminal.settle();
		expect(onSettle).toHaveBeenCalledTimes(1);
	});

	it("runs no timer until armed, even past the timeout", () => {
		const onSettle = vi.fn();
		createTerminalSettle(onSettle, 2000);
		vi.advanceTimersByTime(10_000);
		expect(onSettle).not.toHaveBeenCalled();
	});

	it("falls back to the timeout once armed", () => {
		const onSettle = vi.fn();
		const terminal = createTerminalSettle(onSettle, 2000);
		terminal.arm();
		expect(onSettle).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1999);
		expect(onSettle).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(onSettle).toHaveBeenCalledTimes(1);
	});

	it("does not fire the timeout once settled early", () => {
		const onSettle = vi.fn();
		const terminal = createTerminalSettle(onSettle, 2000);
		terminal.arm();
		terminal.settle();
		vi.advanceTimersByTime(2000);
		expect(onSettle).toHaveBeenCalledTimes(1);
	});

	it("settle before arm suppresses the timer", () => {
		const onSettle = vi.fn();
		const terminal = createTerminalSettle(onSettle, 2000);
		terminal.settle();
		terminal.arm();
		vi.advanceTimersByTime(2000);
		expect(onSettle).toHaveBeenCalledTimes(1);
	});

	it("cancel suppresses the timeout without firing onSettle", () => {
		const onSettle = vi.fn();
		const terminal = createTerminalSettle(onSettle, 2000);
		terminal.arm();
		terminal.cancel();
		vi.advanceTimersByTime(2000);
		expect(onSettle).not.toHaveBeenCalled();
	});

	it("settle after cancel is a no-op", () => {
		const onSettle = vi.fn();
		const terminal = createTerminalSettle(onSettle, 2000);
		terminal.cancel();
		terminal.settle();
		expect(onSettle).not.toHaveBeenCalled();
	});

	it("arm is idempotent: calling it again does not reset or duplicate the timer", () => {
		const onSettle = vi.fn();
		const terminal = createTerminalSettle(onSettle, 2000);
		terminal.arm();
		vi.advanceTimersByTime(1000);
		terminal.arm();
		vi.advanceTimersByTime(999);
		expect(onSettle).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(onSettle).toHaveBeenCalledTimes(1);
	});

	it("arm after settle or cancel is a no-op", () => {
		const onSettle = vi.fn();
		const terminal = createTerminalSettle(onSettle, 2000);
		terminal.settle();
		terminal.arm();
		vi.advanceTimersByTime(2000);
		expect(onSettle).toHaveBeenCalledTimes(1);
	});
});
