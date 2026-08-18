import "server-only";
import { AwsClient } from "aws4fetch";
import { env, isR2Configured } from "@/lib/env";
import type { StorageObject } from "./types";

/*
 * Cloudflare R2 behind its S3-compatible API (docs/adr/0052).
 *
 * aws4fetch rather than @aws-sdk/client-s3 deliberately: this module makes
 * four HTTP calls, and the AWS SDK is megabytes of client machinery that a
 * serverless function would pay for on every cold start. aws4fetch signs a
 * plain fetch and is a few kilobytes.
 *
 * The bucket is private and has no custom domain — nothing here mints a
 * public URL. Reads go out through /api/media, which is the only reason this
 * app never has to configure CORS or public access on the bucket.
 */

let cached: AwsClient | undefined;

function client(): AwsClient {
	if (!cached) {
		const e = env();
		if (!isR2Configured()) {
			throw new Error(
				"R2 is not configured (R2_ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET)",
			);
		}
		cached = new AwsClient({
			accessKeyId: e.R2_ACCESS_KEY_ID as string,
			secretAccessKey: e.R2_SECRET_ACCESS_KEY as string,
			// R2 ignores the region but SigV4 must sign *something*, and it must
			// match what R2 expects to verify against.
			region: "auto",
			service: "s3",
			// aws4fetch defaults to 10 retries on 5xx with exponential backoff —
			// worst case ~51s, spent inside a request a person is watching. Two
			// retries still absorbs a transient blip and fails in well under a
			// second when R2 is actually down.
			retries: 2,
			initRetryMs: 50,
		});
	}
	return cached;
}

/** Bucket root. Keys are appended verbatim — they are already URL-safe (uuid + ext). */
function bucketUrl(): string {
	const e = env();
	return `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${e.R2_BUCKET}`;
}

function objectUrl(key: string): string {
	return `${bucketUrl()}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function fail(res: Response, what: string): Promise<never> {
	// R2 returns an XML error document; include it raw. These land in server
	// logs only, never in a response body.
	const body = await res.text().catch(() => "");
	throw new Error(`R2 ${what} failed: ${res.status} ${res.statusText} ${body}`.trim());
}

/**
 * R2 rejects a chunked PUT with 411 MissingContentLength — it will not accept
 * a streamed body on this endpoint. Whether `fetch` sets Content-Length for you
 * depends on the exact body type and the runtime: under Node a `Buffer` or a
 * `Blob` streams (411), while a plain `Uint8Array` does not. That is far too
 * subtle to rely on, and it fails only against the real service, so the header
 * is set explicitly and the body is normalised to a plain Uint8Array.
 *
 * A copy is taken when the input is a view over a larger buffer (sharp returns
 * one), because byteLength and the bytes actually sent must agree.
 */
export async function putObject(
	key: string,
	bytes: Uint8Array,
	contentType: string,
): Promise<void> {
	const body =
		bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes : bytes.slice();

	const res = await client().fetch(objectUrl(key), {
		method: "PUT",
		body: body as unknown as BodyInit,
		headers: {
			"content-type": contentType,
			"content-length": String(body.byteLength),
		},
	});
	if (!res.ok) await fail(res, `put ${key}`);
}

/** Null when the key does not exist, so callers can 404 instead of 500. */
export async function getObject(key: string): Promise<StorageObject | null> {
	const res = await client().fetch(objectUrl(key), { method: "GET" });
	if (res.status === 404) return null;
	if (!res.ok) await fail(res, `get ${key}`);
	return {
		bytes: new Uint8Array(await res.arrayBuffer()),
		contentType: res.headers.get("content-type") ?? "application/octet-stream",
	};
}

/**
 * Best-effort by design: callers delete objects *after* the durable metadata
 * row is already gone, so a failure here leaks bytes rather than corrupting
 * state. Swallowing keeps a storage hiccup from failing a user-visible delete.
 */
export async function deleteObjects(keys: string[]): Promise<void> {
	await Promise.all(
		keys.map(async (key) => {
			const res = await client().fetch(objectUrl(key), { method: "DELETE" });
			// S3 DELETE is idempotent — a missing key still answers 204.
			if (!res.ok && res.status !== 404) await fail(res, `delete ${key}`);
		}),
	);
}

/**
 * ListObjectsV2. Returns full keys, not names. Paginates: a note with more
 * than 1000 files is absurd, but truncating a delete sweep would silently
 * leak bytes, so the loop is written rather than assumed away.
 */
export async function listPrefix(prefix: string): Promise<string[]> {
	const keys: string[] = [];
	let token: string | undefined;

	do {
		const url = new URL(bucketUrl());
		url.searchParams.set("list-type", "2");
		url.searchParams.set("prefix", prefix);
		if (token) url.searchParams.set("continuation-token", token);

		const res = await client().fetch(url.toString(), { method: "GET" });
		if (!res.ok) await fail(res, `list ${prefix}`);
		const xml = await res.text();

		for (const match of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) {
			keys.push(decodeXmlText(match[1]));
		}
		token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
			? (xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/)?.[1] ?? undefined)
			: undefined;
	} while (token);

	return keys;
}

/** The five predefined XML entities are all S3 emits inside <Key>. */
function decodeXmlText(value: string): string {
	return value
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, "&");
}
