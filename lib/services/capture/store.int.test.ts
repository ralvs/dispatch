import { describe, expect, it } from "vitest";
import { markParsed, persistRaw } from "@/lib/services/capture/store";
import { serviceClient, unreachableClient } from "@/test/integration/clients";

const RAW = { kind: "transcript", text: "verbatim", via: "text" } as const;

describe("persistRaw", () => {
	it("records the text verbatim under source=manual/type=text_capture", async () => {
		const sb = serviceClient();

		const id = await persistRaw(sb, RAW);

		const { data } = await sb.from("captured_data").select("*").eq("id", id).single();
		expect(data).toMatchObject({
			source: "manual",
			type: "text_capture",
			processed_status: "raw",
			payload: { transcript: "verbatim", via: "text", client_time: null },
		});
	});

	it("throws when the row cannot be written — nothing was captured", async () => {
		await expect(persistRaw(unreachableClient(), RAW)).rejects.toThrow();
	});
});

describe("markParsed", () => {
	it("moves the row from raw to parsed", async () => {
		const sb = serviceClient();
		const id = await persistRaw(sb, RAW);

		await markParsed(sb, id);

		const { data } = await sb
			.from("captured_data")
			.select("processed_status")
			.eq("id", id)
			.single();
		expect(data?.processed_status).toBe("parsed");
	});

	it("swallows a failing request so it can never escape into capture()", async () => {
		await expect(markParsed(unreachableClient(), "cap-1")).resolves.toBeUndefined();
	});
});
