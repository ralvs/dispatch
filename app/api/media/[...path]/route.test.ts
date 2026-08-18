import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Stand in for the real guard, keeping its shape: ownerRoute either short-
// circuits with a 401 or hands the handler an auth object. `signedIn` flips
// which, so the same tests cover both sides of iron rule #2.
let signedIn = true;

vi.mock("@/lib/auth", () => ({
	ownerRoute:
		(handler: (req: Request, auth: unknown, ...rest: unknown[]) => Promise<Response>) =>
		async (req: Request, ...rest: unknown[]) => {
			if (!signedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
			return handler(req, { claims: { sub: "owner" }, sb: {} }, ...rest);
		},
}));

vi.mock("@/lib/storage", () => ({
	getObject: vi.fn(async () => null),
}));

import { GET } from "@/app/api/media/[...path]/route";
import { getObject } from "@/lib/storage";

const NOTE_ID = "11111111-2222-4333-8444-555555555555";
const FILE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const KEY = `notes/${NOTE_ID}/${FILE_ID}.webp`;

function call(path: string[], query = "") {
	return GET(new Request(`https://app.test/api/media/${path.join("/")}${query}`), {
		params: Promise.resolve({ path }),
	});
}

beforeEach(() => {
	signedIn = true;
	vi.clearAllMocks();
	vi.mocked(getObject).mockResolvedValue({
		bytes: new Uint8Array([1, 2, 3]),
		contentType: "image/webp",
	});
});

describe("GET /api/media/[...path]", () => {
	it("refuses a signed-out request before touching storage", async () => {
		signedIn = false;
		const res = await call(KEY.split("/"));
		expect(res.status).toBe(401);
		expect(getObject).not.toHaveBeenCalled();
	});

	it("serves the object with its stored content type", async () => {
		const res = await call(KEY.split("/"));
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("image/webp");
		expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
		expect(getObject).toHaveBeenCalledWith(KEY);
	});

	// Immutable caching is what keeps re-reading a note from spending egress
	// twice, which is the whole free-tier budget argument.
	it("marks the response privately cacheable and immutable", async () => {
		const res = await call(KEY.split("/"));
		expect(res.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
		expect(res.headers.get("x-content-type-options")).toBe("nosniff");
	});

	it("serves inline by default and as a download on ?dl=1", async () => {
		const inline = await call(KEY.split("/"));
		expect(inline.headers.get("content-disposition")).toBe("inline");

		const download = await call(KEY.split("/"), "?dl=1&name=report.pdf");
		expect(download.headers.get("content-disposition")).toBe('attachment; filename="report.pdf"');
	});

	it("strips quotes and separators from a caller-supplied download name", async () => {
		const res = await call(KEY.split("/"), "?dl=1&name=%22evil%22%2F..%2Fx.pdf");
		const disposition = res.headers.get("content-disposition") ?? "";
		expect(disposition).toBe('attachment; filename="evil..x.pdf"');
		// One quoted token — nothing broke out of the quoted string.
		expect(disposition.match(/"/g)).toHaveLength(2);
	});

	it("404s a traversal attempt without asking storage", async () => {
		const res = await call(["notes", NOTE_ID, "..", "..", "secret.txt"]);
		expect(res.status).toBe(404);
		expect(getObject).not.toHaveBeenCalled();
	});

	it("404s any key that is not a note attachment", async () => {
		for (const path of [
			["etc", "passwd"],
			["notes", "not-a-uuid", `${FILE_ID}.webp`],
			["notes", NOTE_ID, "evil.sh"],
			["notes", NOTE_ID],
		]) {
			const res = await call(path);
			expect(res.status).toBe(404);
		}
		expect(getObject).not.toHaveBeenCalled();
	});

	it("404s when the key is well-formed but absent", async () => {
		vi.mocked(getObject).mockResolvedValue(null);
		const res = await call(KEY.split("/"));
		expect(res.status).toBe(404);
	});
});
