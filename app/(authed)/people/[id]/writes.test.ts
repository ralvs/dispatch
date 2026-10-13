import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createPersonFactForm,
	createPersonInteractionForm,
	interactionOccurredAt,
	updatePersonForm,
} from "@/lib/schemas/person";
import type { IntentCtx } from "@/lib/store/types";
import {
	createFactAction,
	createInteractionAction,
	deleteFactAction,
	deleteInteractionAction,
	deletePersonAction,
	updatePersonAction,
} from "./actions";
import { personFactWrites, personInteractionWrites, personWrites } from "./writes";

vi.mock("./actions", () => ({
	createFactAction: vi.fn(),
	createInteractionAction: vi.fn(),
	deleteFactAction: vi.fn(),
	deleteInteractionAction: vi.fn(),
	deletePersonAction: vi.fn(),
	updatePersonAction: vi.fn(),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

const ctx: IntentCtx = {
	todayIso: "2026-07-15",
	tz: "America/Sao_Paulo",
	nowIso: "2026-07-15T12:00:00.000Z",
};

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

const TZ = "America/Sao_Paulo";

// One decode, two halves (docs/adr/0087): what the server parses is what the
// page shows, and a form the server refuses shows nothing.
const updateCases: Case[] = [
	{
		name: "a rename, a relationship, a cleared company",
		fields: { name: " Ana ", relationship_type: "friend", company: "" },
		server: { name: "Ana", relationship_type: "friend", company: null },
		shown: { name: "Ana", relationship_type: "friend", company: null },
	},
	{
		name: "a field the form did not render is left alone",
		fields: { notes: "Met at the fair" },
		server: { notes: "Met at the fair" },
		shown: { notes: "Met at the fair" },
	},
	{ name: "a bad relationship", fields: { relationship_type: "nope" }, server: "refused" },
];

describe("personWrites.update agrees with the server's decode", () => {
	for (const c of updateCases) {
		it(c.name, async () => {
			const fd = form(c.fields);
			const w = personWrites.update("p1", fd);
			if (c.server === "refused") {
				expect(() => updatePersonForm.parse(fd)).toThrow();
				expect(w.intent).toEqual({ type: "patch", id: "p1", patch: {} });
			} else {
				expect(updatePersonForm.parse(fd)).toEqual(c.server);
				expect(w.intent).toEqual({ type: "patch", id: "p1", patch: c.shown });
			}
			expect(w.errorMessage).toBe("Couldn't save person.");
			await w.call(ctx);
			expect(updatePersonAction).toHaveBeenCalledWith("p1", fd);
		});
	}
});

const factCases: Case[] = [
	{
		name: "a birthday with its day",
		fields: { fact_type: "birthday", fact_value: " May 3 ", date_relevant: "2026-05-03" },
		server: { fact_type: "birthday", fact_value: "May 3", date_relevant: "2026-05-03" },
		shown: {
			person_id: "p1",
			fact_type: "birthday",
			fact_value: "May 3",
			date_relevant: "2026-05-03",
			recurring: false,
		},
	},
	{
		name: "no day",
		fields: { fact_type: "other", fact_value: "x", date_relevant: "" },
		server: { fact_type: "other", fact_value: "x", date_relevant: null },
		shown: { fact_type: "other", date_relevant: null },
	},
	{
		name: "a bad day",
		fields: { fact_type: "birthday", fact_value: "x", date_relevant: "nope" },
		server: "refused",
	},
	{ name: "no value", fields: { fact_type: "other", fact_value: " " }, server: "refused" },
	{ name: "a bad type", fields: { fact_type: "nope", fact_value: "x" }, server: "refused" },
];

describe("personFactWrites.create agrees with the server's decode", () => {
	for (const c of factCases) {
		it(c.name, async () => {
			const fd = form(c.fields);
			const w = personFactWrites.create("p1", fd);
			if (c.server === "refused") {
				expect(() => createPersonFactForm.parse(fd)).toThrow();
				expect(w.intent).toEqual({ type: "patch", id: expect.any(String), patch: {} });
			} else {
				expect(createPersonFactForm.parse(fd)).toEqual(c.server);
				expect(w.intent).toMatchObject({ type: "create", row: c.shown });
			}
			await w.call(ctx);
			expect(createFactAction).toHaveBeenCalledWith("p1", fd);
		});
	}
});

/** The server's read of the interaction form: its occurred_at override, then the decoder. */
function serverInteraction(fd: FormData) {
	return createPersonInteractionForm.parse(fd, { occurred_at: interactionOccurredAt(fd, TZ) });
}

const interactionCases: Case[] = [
	{
		name: "dated in the app timezone",
		fields: { interaction_type: "call", occurred_date: "2026-07-14", occurred_time: "09:00" },
		server: { interaction_type: "call", occurred_at: "2026-07-14T12:00:00.000Z" },
		shown: { person_id: "p1", interaction_type: "call", occurred_at: "2026-07-14T12:00:00.000Z" },
	},
	{
		name: "a day without a time is midnight",
		fields: { interaction_type: "text", occurred_date: "2026-07-14", notes: "" },
		server: { interaction_type: "text", occurred_at: "2026-07-14T03:00:00.000Z", notes: null },
		shown: { interaction_type: "text", occurred_at: "2026-07-14T03:00:00.000Z", notes: null },
	},
	{
		// The server sends null and the database stamps now(); the shown row
		// needs a string, so it carries the client's clock as the stand-in.
		name: "no day is now",
		fields: { interaction_type: "email", notes: "Hi" },
		server: { interaction_type: "email", occurred_at: null, notes: "Hi" },
		shown: { interaction_type: "email", notes: "Hi", occurred_at: expect.any(String) },
	},
	{ name: "a bad type", fields: { interaction_type: "nope" }, server: "refused" },
	{
		name: "a bad time",
		fields: { interaction_type: "call", occurred_date: "2026-07-14", occurred_time: "25:99" },
		server: "refused",
	},
];

describe("personInteractionWrites.create agrees with the server's decode", () => {
	for (const c of interactionCases) {
		it(c.name, async () => {
			const fd = form(c.fields);
			const w = personInteractionWrites.create("p1", fd, TZ);
			if (c.server === "refused") {
				expect(() => serverInteraction(fd)).toThrow();
				expect(w.intent).toEqual({ type: "patch", id: expect.any(String), patch: {} });
			} else {
				expect(serverInteraction(fd)).toEqual(c.server);
				expect(w.intent).toMatchObject({ type: "create", row: c.shown });
			}
			await w.call(ctx);
			expect(createInteractionAction).toHaveBeenCalledWith("p1", fd);
		});
	}
});

describe("personWrites", () => {
	it("a delete names the same person", async () => {
		const w = personWrites.remove("p1");
		expect(w.intent).toEqual({ type: "delete", id: "p1" });
		await w.call(ctx);
		expect(deletePersonAction).toHaveBeenCalledWith("p1");
	});
});

describe("personFactWrites", () => {
	it("a delete names the same fact", async () => {
		const w = personFactWrites.remove("p1", "f1");
		expect(w.intent).toEqual({ type: "delete", id: "f1" });
		await w.call(ctx);
		expect(deleteFactAction).toHaveBeenCalledWith("p1", "f1");
	});
});

describe("personInteractionWrites", () => {
	it("a delete names the same interaction", async () => {
		const w = personInteractionWrites.remove("p1", "i1");
		expect(w.intent).toEqual({ type: "delete", id: "i1" });
		await w.call(ctx);
		expect(deleteInteractionAction).toHaveBeenCalledWith("p1", "i1");
	});
});
