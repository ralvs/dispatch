import { describe, expect, it } from "vitest";
import { persistRaw } from "@/lib/services/capture/store";
import { sweepRawCaptures } from "@/lib/services/capture/sweep";
import { serviceClient } from "@/test/integration/clients";

// The sweep runs from cron under the service-role client. Rows are made
// orphans by sweeping from an hour in the future — far past the 10-minute
// threshold, so clock skew between the test and the database cannot matter.
const LATER = () => Date.now() + 60 * 60_000;

async function rawCapture(text: string): Promise<string> {
	return persistRaw(serviceClient(), { kind: "transcript", text, via: "voice" });
}

async function statusOf(id: string): Promise<string | undefined> {
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
		.select("body, needs_review")
		.eq("origin_capture_id", id);
	return data ?? [];
}

describe("sweepRawCaptures", () => {
	it("degrades an orphan to a needs_review note and marks it parsed", async () => {
		const id = await rawCapture("comprar leite");

		const result = await sweepRawCaptures(serviceClient(), { nowMs: LATER() });

		expect(result).toEqual({ swept: [id], reconciled: [] });
		expect(await notesFor(id)).toEqual([{ body: "comprar leite", needs_review: true }]);
		expect(await statusOf(id)).toBe("parsed");
	});

	it("skips the note but still marks parsed when a note already links the capture", async () => {
		const sb = serviceClient();
		const id = await rawCapture("x");
		await sb.from("notes").insert({ body: "x", origin_capture_id: id, needs_review: true });

		const result = await sweepRawCaptures(sb, { nowMs: LATER() });

		expect(result).toEqual({ swept: [], reconciled: [id] });
		expect(await notesFor(id)).toHaveLength(1);
		expect(await statusOf(id)).toBe("parsed");
	});

	it("falls back to JSON for a payload without a transcript", async () => {
		const sb = serviceClient();
		const { data } = await sb
			.from("captured_data")
			.insert({ source: "manual", type: "text_capture", payload: { foo: 1 } })
			.select("id")
			.single();
		const id = data?.id as string;

		await sweepRawCaptures(sb, { nowMs: LATER() });

		expect((await notesFor(id))[0]?.body).toBe('{"foo":1}');
	});

	it("leaves a capture younger than the threshold alone", async () => {
		const id = await rawCapture("just now");

		const result = await sweepRawCaptures(serviceClient(), { olderThanMinutes: 10 });

		expect(result).toEqual({ swept: [], reconciled: [] });
		expect(await statusOf(id)).toBe("raw");
	});
});
