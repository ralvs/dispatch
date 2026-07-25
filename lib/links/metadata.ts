import "server-only";

// ─────────────────────────────────────────────────────────────────────────
// Link metadata fetch (docs/adr/0022). A shared URL arrives bare, so the
// reading list at /links used to be a wall of raw hrefs. This resolves a
// title and a one-line description from the page's own <head>.
//
// Every failure mode returns nulls rather than throwing: an unreachable host,
// a slow server, a login wall, or an HTML page with no metadata must still
// produce a saved link. Same contract as the AI parser — the enrichment is a
// nicety, the row is the guarantee (iron rule #4).
//
// This issues an outbound request to a URL the owner chose, so it is written
// defensively: http(s) only, redirects capped, HTML only, body size capped,
// and a hard timeout.
// ─────────────────────────────────────────────────────────────────────────

export type LinkMetadata = { title: string | null; description: string | null };

const TIMEOUT_MS = 5_000;
const MAX_BYTES = 512 * 1024;
const TITLE_MAX = 500;
const DESCRIPTION_MAX = 5_000;

// A desktop UA: several publishers return a stub or a consent page to an
// unrecognised agent, which would leave us with a useless title.
const USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** Decodes the five XML entities plus numeric escapes that appear in meta content. */
function decodeEntities(s: string): string {
	return (
		s
			.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
			.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
			.replace(/&quot;/g, '"')
			.replace(/&apos;/g, "'")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&nbsp;/g, " ")
			// Ampersand last, so "&amp;lt;" does not become "<".
			.replace(/&amp;/g, "&")
	);
}

function clean(raw: string | undefined, max: number): string | null {
	if (!raw) return null;
	const text = decodeEntities(raw).replace(/\s+/g, " ").trim();
	if (text.length === 0) return null;
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Reads one `<meta>` value by property/name, whichever order the attributes
 * appear in. Deliberately regex and not a DOM parse: this runs on a hostile
 * document and only ever needs two fields from the head.
 */
function metaContent(html: string, key: string): string | undefined {
	const attr = `(?:property|name)\\s*=\\s*["']${key}["']`;
	const content = `content\\s*=\\s*["']([^"']*)["']`;
	return (
		html.match(new RegExp(`<meta[^>]+${attr}[^>]*${content}`, "i"))?.[1] ??
		html.match(new RegExp(`<meta[^>]+${content}[^>]*${attr}`, "i"))?.[1]
	);
}

export function parseMetadata(html: string): LinkMetadata {
	// Only the head can carry the metadata, and stopping there keeps the
	// regexes off megabytes of body markup.
	const head = html.split(/<\/head>/i)[0] ?? html;

	const title =
		clean(metaContent(head, "og:title"), TITLE_MAX) ??
		clean(metaContent(head, "twitter:title"), TITLE_MAX) ??
		clean(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], TITLE_MAX);

	const description =
		clean(metaContent(head, "og:description"), DESCRIPTION_MAX) ??
		clean(metaContent(head, "twitter:description"), DESCRIPTION_MAX) ??
		clean(metaContent(head, "description"), DESCRIPTION_MAX);

	return { title, description };
}

/** Reads at most MAX_BYTES of the body, so a giant or endless page cannot hang us. */
async function readCapped(response: Response): Promise<string> {
	const reader = response.body?.getReader();
	if (!reader) return "";

	const decoder = new TextDecoder();
	const chunks: string[] = [];
	let total = 0;
	try {
		while (total < MAX_BYTES) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			chunks.push(decoder.decode(value, { stream: true }));
			// The head is all we need; stop as soon as it closes.
			if (chunks.join("").match(/<\/head>/i)) break;
		}
	} finally {
		await reader.cancel().catch(() => {});
	}
	return chunks.join("");
}

/**
 * Best-effort title/description for a shared URL. Never throws and never
 * rejects — an unreachable page yields `{title: null, description: null}` and
 * the link is stored bare, exactly as it was before this existed.
 */
export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
	const empty: LinkMetadata = { title: null, description: null };

	try {
		const parsed = new URL(url);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return empty;

		const response = await fetch(parsed, {
			redirect: "follow",
			signal: AbortSignal.timeout(TIMEOUT_MS),
			headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
		});
		if (!response.ok) return empty;

		// A PDF or an image has no <head> to read; don't download it to find out.
		const contentType = response.headers.get("content-type") ?? "";
		if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) return empty;

		return parseMetadata(await readCapped(response));
	} catch {
		// DNS failure, TLS error, timeout, malformed URL — all the same here.
		return empty;
	}
}
