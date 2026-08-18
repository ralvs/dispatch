import { NextResponse } from "next/server";
import { ownerRoute } from "@/lib/auth";
import { getObject } from "@/lib/storage";

/*
 * The read side of note attachments (docs/adr/0052).
 *
 * The R2 bucket is private and has no custom domain. Rather than minting
 * signed URLs — which expire, and would rot inside the cross-request "use
 * cache" entry that serves /notes — every file is read through here under the
 * owner check. That is what lets the URL persisted in `notes.attachments` be
 * a stable app-relative path, and why the bucket needs no CORS or public
 * access configured at all.
 *
 * Cookies ride along on same-origin <img> requests, so this works for
 * thumbnails exactly as it does for a clicked PDF.
 */

/** Keys are `notes/<uuid>/<uuid>.<ext>`. Nothing else is addressable. */
const KEY_PATTERN = /^notes\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{1,5}$/i;

export const GET = ownerRoute(
	async (request, _auth, ctx: { params: Promise<{ path: string[] }> }) => {
		const { path } = await ctx.params;
		const segments = path ?? [];
		const key = segments.join("/");

		// Belt and braces: the shape check below already excludes traversal, but
		// a segment check states the intent at the boundary where it matters.
		if (segments.some((segment) => segment === ".." || segment === "." || segment === "")) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}
		if (!KEY_PATTERN.test(key)) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}

		const object = await getObject(key);
		if (!object) return NextResponse.json({ error: "Not found" }, { status: 404 });

		const url = new URL(request.url);
		const download = url.searchParams.get("dl") === "1";

		return new NextResponse(object.bytes as unknown as BodyInit, {
			headers: {
				"content-type": object.contentType,
				"content-length": String(object.bytes.byteLength),
				"content-disposition": download
					? `attachment; filename="${sanitizeFilename(url.searchParams.get("name"))}"`
					: "inline",
				// Keys carry a uuid, so the bytes at one key never change. A year
				// of private caching is what stops re-reading a note spending
				// bandwidth twice — the point of the free tier's egress budget.
				"cache-control": "private, max-age=31536000, immutable",
				// The content type is ours, taken from what we stored. Stop the
				// browser second-guessing it into something executable.
				"x-content-type-options": "nosniff",
			},
		});
	},
);

/**
 * The download name is a query param, so it is caller-controlled: strip
 * quotes, control characters, and path separators before it lands inside a
 * Content-Disposition header.
 */
function sanitizeFilename(name: string | null): string {
	if (!name) return "download";
	const cleaned = name
		// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point
		.replace(/[\u0000-\u001f\u007f"\\/]/g, "")
		.trim();
	return cleaned === "" ? "download" : cleaned.slice(0, 120);
}
