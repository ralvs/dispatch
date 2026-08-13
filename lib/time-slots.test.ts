import { describe, expect, it } from "vitest";
import { wallClockSlots } from "./time-slots";

describe("wallClockSlots", () => {
	it("emits 96 quarter-hour labels by default", () => {
		const slots = wallClockSlots();
		expect(slots).toHaveLength(96);
		expect(slots[0]).toBe("00:00");
		expect(slots[1]).toBe("00:15");
		expect(slots.at(-1)).toBe("23:45");
	});

	it("accepts a coarser step", () => {
		const slots = wallClockSlots(30);
		expect(slots).toHaveLength(48);
		expect(slots.slice(0, 3)).toEqual(["00:00", "00:30", "01:00"]);
		expect(slots.at(-1)).toBe("23:30");
	});
});
