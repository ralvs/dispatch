import { describe, expect, it } from "vitest";
import { inListLiteral } from "@/lib/services/in-list";
import { serviceClient } from "@/test/integration/clients";

// The calendar syncs delete rows NOT in the seen set. If PostgREST misreads
// the literal, that set is wrong and live events get deleted — so the escaping
// is checked against the real parser, not only against a string.

describe("inListLiteral against PostgREST", () => {
	it("matches values with quotes, backslashes and commas exactly", async () => {
		const sb = serviceClient();
		const tricky = ['https://a.test/"quoted"', "https://a.test/ends\\", "https://a.test/x,y"];
		const plain = "https://a.test/plain";
		const { error } = await sb
			.from("ingest_links")
			.insert([...tricky, plain].map((url) => ({ url })));
		expect(error).toBeNull();

		const { data, error: readError } = await sb
			.from("ingest_links")
			.select("url")
			.not("url", "in", inListLiteral(tricky));
		expect(readError).toBeNull();
		expect(data?.map((r) => r.url)).toEqual([plain]);
	});
});
