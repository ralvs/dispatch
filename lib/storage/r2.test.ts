import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
	env: () => ({
		R2_ACCOUNT_ID: "acct123",
		R2_ACCESS_KEY_ID: "key123",
		R2_SECRET_ACCESS_KEY: "secret123",
		R2_BUCKET: "dispatch",
	}),
	isR2Configured: () => true,
}));

import { deleteObjects, getObject, listPrefix, putObject } from "@/lib/storage/r2";

const BASE = "https://acct123.r2.cloudflarestorage.com/dispatch";

const fetchMock = vi.fn();

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function ok(body: BodyInit = "", init: ResponseInit = {}) {
	return new Response(body, { status: 200, ...init });
}

/** aws4fetch calls the global fetch with a Request; read what it signed. */
function lastRequest(): Request {
	const [input] = fetchMock.mock.calls.at(-1) ?? [];
	return input as Request;
}

describe("putObject", () => {
	it("PUTs to the bucket-scoped key with a signed authorization header", async () => {
		fetchMock.mockResolvedValue(ok());
		await putObject("notes/a/b.webp", new Uint8Array([1, 2, 3]), "image/webp");

		const req = lastRequest();
		expect(req.method).toBe("PUT");
		expect(req.url).toBe(`${BASE}/notes/a/b.webp`);
		expect(req.headers.get("content-type")).toBe("image/webp");
		// Signed, without asserting the exact SigV4 string.
		expect(req.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=key123/);
	});

	it("throws with the status when R2 refuses", async () => {
		fetchMock.mockResolvedValue(new Response("<Error>denied</Error>", { status: 403 }));
		await expect(putObject("notes/a/b.webp", new Uint8Array([1]), "image/webp")).rejects.toThrow(
			/403/,
		);
	});
});

describe("getObject", () => {
	it("returns the bytes and the stored content type", async () => {
		fetchMock.mockResolvedValue(
			ok(new Uint8Array([9, 8, 7]), { headers: { "content-type": "application/pdf" } }),
		);

		const result = await getObject("notes/a/b.pdf");
		expect(result?.contentType).toBe("application/pdf");
		expect(result?.bytes).toEqual(new Uint8Array([9, 8, 7]));
		expect(lastRequest().method).toBe("GET");
	});

	// The media route turns this null into a 404 rather than a 500.
	it("returns null for a missing key", async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
		expect(await getObject("notes/a/missing.pdf")).toBeNull();
	});

	// aws4fetch retries 5xx by default. Capped at 2 in the adapter, because the
	// default of 10 with exponential backoff spends ~51s inside a request a
	// person is watching.
	it("throws on a server error, which is not the same as absent", async () => {
		fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
		await expect(getObject("notes/a/b.pdf")).rejects.toThrow(/500/);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});
});

describe("deleteObjects", () => {
	it("issues one DELETE per key", async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
		await deleteObjects(["notes/a/one.webp", "notes/a/two.pdf"]);

		expect(fetchMock).toHaveBeenCalledTimes(2);
		// deleteObjects fans out through Promise.all, so the calls race — assert
		// the set, not the order, or this passes or fails on scheduler timing.
		const urls = fetchMock.mock.calls.map(([req]) => (req as Request).url).sort();
		expect(urls).toEqual([`${BASE}/notes/a/one.webp`, `${BASE}/notes/a/two.pdf`].sort());
	});

	// S3 DELETE is idempotent; a missing key is success, not an error.
	it("treats a missing key as already deleted", async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
		await expect(deleteObjects(["notes/a/gone.webp"])).resolves.toBeUndefined();
	});
});

describe("listPrefix", () => {
	function listXml(keys: string[], truncated = false, next = "") {
		return `<?xml version="1.0"?><ListBucketResult>${keys
			.map((k) => `<Contents><Key>${k}</Key></Contents>`)
			.join("")}<IsTruncated>${truncated}</IsTruncated>${
			truncated ? `<NextContinuationToken>${next}</NextContinuationToken>` : ""
		}</ListBucketResult>`;
	}

	it("asks for the v2 listing under the prefix and returns full keys", async () => {
		fetchMock.mockResolvedValue(ok(listXml(["notes/a/one.webp", "notes/a/two.pdf"])));

		const keys = await listPrefix("notes/a/");
		expect(keys).toEqual(["notes/a/one.webp", "notes/a/two.pdf"]);

		const url = new URL(lastRequest().url);
		expect(url.searchParams.get("list-type")).toBe("2");
		expect(url.searchParams.get("prefix")).toBe("notes/a/");
	});

	// Truncating a delete sweep would silently leak bytes.
	it("follows the continuation token to the end", async () => {
		fetchMock
			.mockResolvedValueOnce(ok(listXml(["notes/a/one.webp"], true, "TOKEN2")))
			.mockResolvedValueOnce(ok(listXml(["notes/a/two.pdf"])));

		expect(await listPrefix("notes/a/")).toEqual(["notes/a/one.webp", "notes/a/two.pdf"]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(new URL(lastRequest().url).searchParams.get("continuation-token")).toBe("TOKEN2");
	});

	it("decodes XML entities in a key", async () => {
		fetchMock.mockResolvedValue(ok(listXml(["notes/a/b&amp;c.pdf"])));
		expect(await listPrefix("notes/a/")).toEqual(["notes/a/b&c.pdf"]);
	});

	it("returns empty for an empty prefix", async () => {
		fetchMock.mockResolvedValue(ok(listXml([])));
		expect(await listPrefix("notes/nothing/")).toEqual([]);
	});
});
