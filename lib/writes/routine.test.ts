import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createRoutineAction,
	toggleCompletionAction,
	updateRoutineAction,
} from "@/lib/actions/routines";
import { createRoutineForm, updateRoutineForm } from "@/lib/schemas/routine";
import type { IntentCtx } from "@/lib/store/types";
import { routineWrites } from "./routine";

vi.mock("@/lib/actions/routines", () => ({
	archiveRoutineAction: vi.fn(),
	createRoutineAction: vi.fn(),
	deleteRoutineAction: vi.fn(),
	toggleCompletionAction: vi.fn(),
	updateRoutineAction: vi.fn(),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

const ctx: IntentCtx = {
	todayIso: "2026-07-15",
	tz: "America/Sao_Paulo",
	nowIso: "2026-07-15T12:00:00.000Z",
};

describe("routineWrites.toggle", () => {
	it("the intent and the call name the same day, whatever the clock says", async () => {
		const w = routineWrites.toggle({ id: "r1", date: "2026-07-14", done: true });
		expect(w.intent).toEqual({ type: "toggle", id: "r1", date: "2026-07-14", done: true });
		await w.call(ctx);
		expect(toggleCompletionAction).toHaveBeenCalledWith("r1", false, "2026-07-14");
	});

	it("an untick sends currentlyDone = true", async () => {
		await routineWrites.toggle({ id: "r1", date: "2026-07-15", done: false }).call(ctx);
		expect(toggleCompletionAction).toHaveBeenCalledWith("r1", true, "2026-07-15");
	});
});

function form(fields: Record<string, string>): FormData {
	const fd = new FormData();
	for (const [k, v] of Object.entries(fields)) fd.set(k, v);
	return fd;
}

type Case = {
	name: string;
	fields: Record<string, string>;
	server: Record<string, unknown> | "refused";
	shown?: Record<string, unknown>;
};

// One decode, two halves (docs/adr/0087): what the server parses is what the
// list shows, and a form the server refuses shows nothing.
const createCases: Case[] = [
	{
		name: "a name and a time of day",
		fields: { name: " Run ", time_of_day: "morning" },
		server: { name: "Run", time_of_day: "morning" },
		shown: { name: "Run", time_of_day: "morning", completions: [] },
	},
	{
		name: "no time of day is anytime",
		fields: { name: "Read" },
		server: { name: "Read" },
		shown: { name: "Read", time_of_day: "anytime" },
	},
	{ name: "no name", fields: { name: " ", time_of_day: "evening" }, server: "refused" },
	{ name: "a bad time of day", fields: { name: "Run", time_of_day: "noon" }, server: "refused" },
];

describe("routineWrites.create agrees with the server's decode", () => {
	for (const c of createCases) {
		it(c.name, async () => {
			const fd = form(c.fields);
			const w = routineWrites.create(fd);
			if (c.server === "refused") {
				expect(() => createRoutineForm.parse(fd)).toThrow();
				expect(w.intent).toMatchObject({ type: "edit", patch: {} });
			} else {
				expect(createRoutineForm.parse(fd)).toEqual(c.server);
				expect(w.intent).toMatchObject({ type: "create", routine: c.shown });
			}
			await w.call(ctx);
			expect(createRoutineAction).toHaveBeenCalledWith(fd);
		});
	}
});

const updateCases: Case[] = [
	{
		name: "a rename and a new time of day",
		fields: { name: " Run 5k ", time_of_day: "evening" },
		server: { name: "Run 5k", time_of_day: "evening" },
		shown: { name: "Run 5k", time_of_day: "evening" },
	},
	{
		name: "a blank name is left alone",
		fields: { name: "", time_of_day: "morning" },
		server: { time_of_day: "morning" },
		shown: { time_of_day: "morning" },
	},
	{ name: "a bad time of day", fields: { name: "Run", time_of_day: "noon" }, server: "refused" },
];

describe("routineWrites.update agrees with the server's decode", () => {
	for (const c of updateCases) {
		it(c.name, async () => {
			const fd = form(c.fields);
			const w = routineWrites.update("r1", fd);
			if (c.server === "refused") {
				expect(() => updateRoutineForm.parse(fd)).toThrow();
				expect(w.intent).toEqual({ type: "edit", id: "r1", patch: {} });
			} else {
				expect(updateRoutineForm.parse(fd)).toEqual(c.server);
				expect(w.intent).toEqual({ type: "edit", id: "r1", patch: c.shown });
			}
			expect(w.errorMessage).toBe("Couldn't save routine.");
			await w.call(ctx);
			expect(updateRoutineAction).toHaveBeenCalledWith("r1", fd);
		});
	}
});
