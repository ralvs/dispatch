import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDebouncedSave } from "@/lib/debounced-save";

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("createDebouncedSave", () => {
	it("fires after 2000ms of quiet", () => {
		const save = vi.fn();
		const debounced = createDebouncedSave(save);

		debounced.schedule("hello");
		expect(save).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1999);
		expect(save).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(save).toHaveBeenCalledExactlyOnceWith("hello");
	});

	it("resets the delay on new input", () => {
		const save = vi.fn();
		const debounced = createDebouncedSave(save);

		debounced.schedule("hel");
		vi.advanceTimersByTime(1500);
		debounced.schedule("hello");
		vi.advanceTimersByTime(1500);
		expect(save).not.toHaveBeenCalled();

		vi.advanceTimersByTime(500);
		expect(save).toHaveBeenCalledExactlyOnceWith("hello");
	});

	it("flush forces an immediate fire", () => {
		const save = vi.fn();
		const debounced = createDebouncedSave(save);

		debounced.schedule("draft");
		debounced.flush();
		expect(save).toHaveBeenCalledExactlyOnceWith("draft");

		vi.advanceTimersByTime(5000);
		expect(save).toHaveBeenCalledTimes(1);
	});

	it("does not fire when clean (nothing scheduled)", () => {
		const save = vi.fn();
		const debounced = createDebouncedSave(save);

		debounced.flush();
		vi.advanceTimersByTime(5000);
		expect(save).not.toHaveBeenCalled();
	});

	it("cancel clears a pending save without running it", () => {
		const save = vi.fn();
		const debounced = createDebouncedSave(save);

		debounced.schedule("draft");
		debounced.cancel();
		vi.advanceTimersByTime(5000);
		expect(save).not.toHaveBeenCalled();
	});

	it("flush after a save already fired does nothing (clean again)", () => {
		const save = vi.fn();
		const debounced = createDebouncedSave(save);

		debounced.schedule("draft");
		vi.advanceTimersByTime(2000);
		expect(save).toHaveBeenCalledTimes(1);

		debounced.flush();
		expect(save).toHaveBeenCalledTimes(1);
	});
});
