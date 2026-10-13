import { beforeEach, describe, expect, it, vi } from "vitest";
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

describe("personWrites", () => {
	it("an edit patches what the form says and sends the same form", async () => {
		const fd = form({ name: " Ana ", relationship_type: "friend", company: "" });
		const w = personWrites.update("p1", fd);
		expect(w.intent).toMatchObject({
			type: "patch",
			id: "p1",
			patch: { name: "Ana", relationship_type: "friend", company: null },
		});
		await w.call(ctx);
		expect(updatePersonAction).toHaveBeenCalledWith("p1", fd);
	});

	it("a delete names the same person", async () => {
		const w = personWrites.remove("p1");
		expect(w.intent).toEqual({ type: "delete", id: "p1" });
		await w.call(ctx);
		expect(deletePersonAction).toHaveBeenCalledWith("p1");
	});
});

describe("personFactWrites", () => {
	it("a new fact shows on the person it was added to", async () => {
		const fd = form({ fact_type: "birthday", fact_value: "May 3", date_relevant: "nope" });
		const w = personFactWrites.create("p1", fd);
		expect(w.intent).toMatchObject({
			type: "create",
			row: { person_id: "p1", fact_type: "birthday", fact_value: "May 3", date_relevant: null },
		});
		await w.call(ctx);
		expect(createFactAction).toHaveBeenCalledWith("p1", fd);
	});

	it("a delete names the same fact", async () => {
		const w = personFactWrites.remove("p1", "f1");
		expect(w.intent).toEqual({ type: "delete", id: "f1" });
		await w.call(ctx);
		expect(deleteFactAction).toHaveBeenCalledWith("p1", "f1");
	});
});

describe("personInteractionWrites", () => {
	it("dates the interaction in the app timezone", async () => {
		const fd = form({
			interaction_type: "call",
			occurred_date: "2026-07-14",
			occurred_time: "09:00",
		});
		const w = personInteractionWrites.create("p1", fd, "America/Sao_Paulo");
		expect(w.intent).toMatchObject({
			type: "create",
			row: { person_id: "p1", interaction_type: "call", occurred_at: "2026-07-14T12:00:00.000Z" },
		});
		await w.call(ctx);
		expect(createInteractionAction).toHaveBeenCalledWith("p1", fd);
	});

	it("a delete names the same interaction", async () => {
		const w = personInteractionWrites.remove("p1", "i1");
		expect(w.intent).toEqual({ type: "delete", id: "i1" });
		await w.call(ctx);
		expect(deleteInteractionAction).toHaveBeenCalledWith("p1", "i1");
	});
});
