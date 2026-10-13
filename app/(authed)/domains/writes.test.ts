import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	archiveDomainAction,
	createDomainAction,
	markDomainShippedAction,
	reactivateDomainAction,
	updateDomainAction,
} from "@/app/(authed)/domains/actions";
import { createDomainForm, updateDomainForm } from "@/lib/schemas/domain";
import type { IntentCtx } from "@/lib/store/types";
import { domainWrites } from "./writes";

vi.mock("@/app/(authed)/domains/actions", () => ({
	archiveDomainAction: vi.fn(),
	createDomainAction: vi.fn(),
	markDomainShippedAction: vi.fn(),
	reactivateDomainAction: vi.fn(),
	updateDomainAction: vi.fn(),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

const ctx: IntentCtx = {
	todayIso: "2026-07-15",
	tz: "America/Sao_Paulo",
	nowIso: "2026-07-15T12:00:00.000Z",
};

const form = (entries: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(entries)) f.set(k, v);
	return f;
};

// One decode, two halves (docs/adr/0087): what the server parses is what the
// list shows, and a form the server refuses shows nothing.
const createCases: {
	name: string;
	fields: Record<string, string>;
	server: Record<string, unknown> | "refused";
	row?: Record<string, unknown>;
}[] = [
	{
		name: "a name, a colour, a blank description",
		fields: { name: " Health ", color: "health", description: "" },
		server: { name: "Health", color: "health", description: null },
		row: { name: "Health", color: "health", description: null, touch: null, cadenceDays: null },
	},
	{ name: "no name", fields: { name: " " }, server: "refused" },
	{ name: "a bad colour", fields: { name: "Health", color: "mauve" }, server: "refused" },
];

describe("domainWrites.create agrees with the server's decode", () => {
	for (const c of createCases) {
		it(c.name, async () => {
			const f = form(c.fields);
			const w = domainWrites.create(f);
			if (c.server === "refused") {
				expect(() => createDomainForm.parse(f)).toThrow();
				expect(w.intent).toMatchObject({ type: "patch", patch: {} });
			} else {
				expect(createDomainForm.parse(f)).toEqual(c.server);
				expect(w.intent).toMatchObject({ type: "create", row: c.row });
			}
			await w.call(ctx);
			expect(createDomainAction).toHaveBeenCalledWith(f);
		});
	}
});

const updateCases: {
	name: string;
	fields: Record<string, string>;
	server: Record<string, unknown> | "refused";
	patch?: Record<string, unknown>;
}[] = [
	{
		name: "a rename and a cadence",
		fields: { name: "Work", cadence_days: " 7 ", description: "" },
		server: { name: "Work", cadence_days: 7, description: null },
		patch: { name: "Work", cadenceDays: 7, description: null },
	},
	{
		name: "a blank cadence clears the rule",
		fields: { cadence_days: "" },
		server: { cadence_days: null },
		patch: { cadenceDays: null },
	},
	{
		name: "a field the form did not render is left alone",
		fields: { expected_cadence: "weekly" },
		server: { expected_cadence: "weekly" },
		patch: { expected_cadence: "weekly" },
	},
	{
		name: "a cadence past a year",
		fields: { name: "Work", cadence_days: "400" },
		server: "refused",
	},
	{ name: "a zero cadence", fields: { cadence_days: "0" }, server: "refused" },
	{ name: "a fractional cadence", fields: { cadence_days: "1.5" }, server: "refused" },
	{ name: "a cadence that is not a number", fields: { cadence_days: "soon" }, server: "refused" },
];

describe("domainWrites.update agrees with the server's decode", () => {
	for (const c of updateCases) {
		it(c.name, async () => {
			const f = form(c.fields);
			const w = domainWrites.update("d1", f);
			if (c.server === "refused") {
				expect(() => updateDomainForm.parse(f)).toThrow();
				expect(w.intent).toEqual({ type: "patch", id: "d1", patch: {} });
			} else {
				expect(updateDomainForm.parse(f)).toEqual(c.server);
				expect(w.intent).toEqual({ type: "patch", id: "d1", patch: c.patch });
			}
			expect(w.errorMessage).toBe("Couldn't save domain.");
			await w.call(ctx);
			expect(updateDomainAction).toHaveBeenCalledWith("d1", f);
		});
	}
});

describe("domainWrites", () => {
	it("archive drops the touch and calls archive on the same id", async () => {
		const w = domainWrites.archive("d1");
		expect(w.intent).toEqual({
			type: "patch",
			id: "d1",
			patch: { active: false, touch: null },
		});
		expect(w.errorMessage).toBe("Couldn't update domain.");
		await w.call(ctx);
		expect(archiveDomainAction).toHaveBeenCalledWith("d1");
	});

	it("mark shipped stamps last_shipped_at and calls the action", async () => {
		const w = domainWrites.markShipped("d1");
		expect(w.intent).toMatchObject({
			type: "patch",
			id: "d1",
			patch: { last_shipped_at: expect.any(String) },
		});
		expect(w.errorMessage).toBe("Couldn't update domain.");
		await w.call(ctx);
		expect(markDomainShippedAction).toHaveBeenCalledWith("d1");
	});

	it("reactivate marks it active and calls reactivate on the same id", async () => {
		const w = domainWrites.reactivate("d1");
		expect(w.intent).toEqual({ type: "patch", id: "d1", patch: { active: true } });
		expect(w.errorMessage).toBe("Couldn't update domain.");
		await w.call(ctx);
		expect(reactivateDomainAction).toHaveBeenCalledWith("d1");
	});
});
