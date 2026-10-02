import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

// The parser is the AI gateway's only caller here: faked, never a paid call.
vi.mock("@/lib/ai/parser", () => ({ parse: vi.fn() }));

import { parse } from "@/lib/ai/parser";
import { capture } from "@/lib/services/capture";
import { listDomains } from "@/lib/services/domains";
import { serviceClient, unreachableClient } from "@/test/integration/clients";

const RAW = { kind: "transcript", text: "ligar pro médico", via: "text" } as const;

beforeEach(() => {
	vi.mocked(parse).mockReset();
	vi.spyOn(console, "info").mockImplementation(() => {});
});

async function capturedStatus(id: string) {
	const { data } = await serviceClient()
		.from("captured_data")
		.select("processed_status")
		.eq("id", id)
		.single();
	return data?.processed_status;
}

async function notesFor(id: string) {
	const { data } = await serviceClient()
		.from("notes")
		.select("id, body, needs_review, tags")
		.eq("origin_capture_id", id);
	return data ?? [];
}

describe("capture", () => {
	it("rethrows when the raw row cannot be written — nothing was captured", async () => {
		await expect(capture(unreachableClient(), RAW)).rejects.toThrow();
		expect(parse).not.toHaveBeenCalled();
	});

	it("executes parsed actions, routes them, and marks the capture parsed", async () => {
		const sb = serviceClient();
		const [domain] = await listDomains(sb);
		// Persist first: the raw row is already durable when the parser runs.
		let rawAtParse: unknown[] = [];
		(parse as Mock).mockImplementation(async () => {
			const { data } = await sb.from("captured_data").select("processed_status");
			rawAtParse = data ?? [];
			return {
				ok: true,
				actions: [{ action: "create_task", title: "ligar pro médico", domain: domain.name }],
			};
		});

		const record = await capture(sb, RAW);

		expect(record.status).toBe("parsed");
		expect(record.outcome.kind).toBe("executed");
		const results = record.outcome.kind === "executed" ? record.outcome.results : [];
		// The row comes back whole, as the entity store will hold it.
		expect(results).toEqual([
			{
				action: "create_task",
				ok: true,
				entity: {
					table: "tasks",
					id: expect.any(String),
					row: expect.objectContaining({
						title: "ligar pro médico",
						domain_id: domain.id,
						domain: expect.objectContaining({ id: domain.id }),
					}),
				},
			},
		]);
		const { data: task } = await sb
			.from("tasks")
			.select("title, domain_id")
			.eq("id", results[0].ok ? results[0].entity.id : "")
			.single();
		expect(task).toEqual({ title: "ligar pro médico", domain_id: domain.id });
		expect(rawAtParse).toEqual([{ processed_status: "raw" }]);
		expect(await capturedStatus(record.capturedId)).toBe("parsed");
		// The parser saw the app's routing lists.
		expect((parse as Mock).mock.calls[0][1].domains).toContain(domain.name);
	});

	it("degrades a parser failure to a needs_review note linked to the capture", async () => {
		const sb = serviceClient();
		(parse as Mock).mockResolvedValue({ ok: false, reason: "failed", raw: RAW.text });

		const record = await capture(sb, RAW);

		const notes = await notesFor(record.capturedId);
		expect(notes).toHaveLength(1);
		expect(notes[0]).toMatchObject({ body: "ligar pro médico", needs_review: true });
		expect(notes[0].tags).toContain("reason:parser_failed");
		expect(record.outcome).toEqual({
			kind: "needs_review",
			noteId: notes[0].id,
			note: expect.objectContaining({ id: notes[0].id, needs_review: true, attachments: [] }),
			reason: "parser_failed",
		});
		expect(await capturedStatus(record.capturedId)).toBe("parsed");
		const { count } = await sb.from("tasks").select("id", { count: "exact", head: true });
		expect(count).toBe(0);
	});

	it("preserves an empty parse as a plain note, not needs_review", async () => {
		(parse as Mock).mockResolvedValue({ ok: false, reason: "empty", raw: "hmm" });

		const record = await capture(serviceClient(), RAW);

		expect(record.outcome.kind).toBe("executed");
		expect(await notesFor(record.capturedId)).toMatchObject([
			{ body: "ligar pro médico", needs_review: false },
		]);
	});

	it("contains a parser that rejects to a last-resort needs_review note", async () => {
		(parse as Mock).mockRejectedValue(new Error("boom"));

		const record = await capture(serviceClient(), RAW);

		const notes = await notesFor(record.capturedId);
		expect(notes).toHaveLength(1);
		expect(notes[0].needs_review).toBe(true);
		expect(record.outcome).toEqual({
			kind: "needs_review",
			noteId: notes[0].id,
			note: expect.objectContaining({ id: notes[0].id, needs_review: true, attachments: [] }),
			reason: "capture_error",
		});
		expect(await capturedStatus(record.capturedId)).toBe("parsed");
	});
});
