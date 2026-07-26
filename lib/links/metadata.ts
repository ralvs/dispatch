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

// Separators publishers hang their masthead off: "Headline — The Verge".
const SITE_SUFFIX = /\s+[|–—·•:«»~-]\s+([^|–—·•:~]+)$/;

/** "Wired" and "WIRED" and "wired" are the same masthead as far as this goes. */
function brand(s: string): string {
	return s
		.toLowerCase()
		.replace(/^the\s+/, "")
		.replace(/[^a-z0-9]/g, "");
}

// Suffixes that are never the brand: the last label, plus the "co" in "co.uk".
const PUBLIC_SUFFIX = new Set(["co", "com", "org", "net", "gov", "edu", "ac"]);

/**
 * Brand candidates hiding in a hostname — "en.wikipedia.org" answers to
 * "Wikipedia". Approximate on purpose; a wrong candidate simply fails to match
 * the title's tail and nothing gets stripped.
 */
function hostBrands(host: string): string[] {
	const labels = host.toLowerCase().split(".").slice(0, -1);
	if (labels.length > 1 && PUBLIC_SUFFIX.has(labels[labels.length - 1] ?? "")) labels.pop();
	return labels.filter((label) => label !== "www" && label.length >= 3);
}

/**
 * Drops the publication name a `<title>` carries so the article's own headline
 * survives: "How the deal fell apart | Reuters" → "How the deal fell apart".
 * Only fires when the tail actually matches the site's declared name or host,
 * so a title that merely contains a dash keeps both halves.
 */
function stripSiteSuffix(title: string, sites: string[]): string {
	const tail = title.match(SITE_SUFFIX);
	if (!tail?.[1]) return title;

	const candidate = brand(tail[1]);
	if (candidate.length === 0) return title;
	if (!sites.some((site) => brand(site) === candidate)) return title;

	const head = title.slice(0, title.length - tail[0].length).trim();
	// A headline shorter than this is likelier a section label than the article.
	return head.length >= 5 ? head : title;
}

export function parseMetadata(html: string, host?: string): LinkMetadata {
	// Only the head can carry the metadata, and stopping there keeps the
	// regexes off megabytes of body markup.
	const head = html.split(/<\/head>/i)[0] ?? html;

	const sites = [
		clean(metaContent(head, "og:site_name"), TITLE_MAX),
		clean(metaContent(head, "application-name"), TITLE_MAX),
		...(host ? hostBrands(host) : []),
	].filter((s): s is string => s !== null);

	// og:title is the headline the publisher declares; <title> is the page's,
	// masthead and all. Both get trimmed — plenty of sites append the brand to
	// og:title too, and the guard in stripSiteSuffix keeps that from overreaching.
	const rawTitle =
		clean(metaContent(head, "og:title"), TITLE_MAX) ??
		clean(metaContent(head, "twitter:title"), TITLE_MAX) ??
		clean(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], TITLE_MAX);
	const title = rawTitle === null ? null : stripSiteSuffix(rawTitle, sites);

	const description =
		clean(metaContent(head, "og:description"), DESCRIPTION_MAX) ??
		clean(metaContent(head, "twitter:description"), DESCRIPTION_MAX) ??
		clean(metaContent(head, "description"), DESCRIPTION_MAX);

	return { title, description };
}

// ─────────────────────────────────────────────────────────────────────────
// oEmbed providers. YouTube serves a JS shell to a plain GET: no og:title, no
// usable <title>, so a shared video landed on /links as a bare "youtube.com".
// Its oEmbed endpoint is keyless, answers for watch/shorts/live/youtu.be alike,
// and returns the video's own title plus the channel — which is what the owner
// meant when they shared the link.
// ─────────────────────────────────────────────────────────────────────────

const YOUTUBE_HOSTS = new Set([
	"youtube.com",
	"www.youtube.com",
	"m.youtube.com",
	"music.youtube.com",
	"youtu.be",
	"www.youtu.be",
]);

function oembedEndpoint(parsed: URL): string | null {
	if (!YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase())) return null;
	return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(parsed.toString())}`;
}

/**
 * Asks the provider directly. Returns null — not empty metadata — when the
 * endpoint declines, so the caller still gets its shot at the HTML head.
 */
async function fetchOembed(endpoint: string): Promise<LinkMetadata | null> {
	try {
		const response = await fetch(endpoint, {
			redirect: "follow",
			signal: AbortSignal.timeout(TIMEOUT_MS),
			headers: { accept: "application/json" },
		});
		// 401/404 here means private, deleted, or not a video URL after all.
		if (!response.ok) return null;

		const body: unknown = await response.json();
		if (typeof body !== "object" || body === null) return null;
		const { title, author_name } = body as { title?: unknown; author_name?: unknown };

		const cleanTitle = typeof title === "string" ? clean(title, TITLE_MAX) : null;
		if (!cleanTitle) return null;

		return {
			title: cleanTitle,
			description: typeof author_name === "string" ? clean(author_name, DESCRIPTION_MAX) : null,
		};
	} catch {
		return null;
	}
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

		// A provider that answers about itself beats scraping its shell.
		const endpoint = oembedEndpoint(parsed);
		if (endpoint) {
			const oembed = await fetchOembed(endpoint);
			if (oembed) return oembed;
		}

		const response = await fetch(parsed, {
			redirect: "follow",
			signal: AbortSignal.timeout(TIMEOUT_MS),
			headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
		});
		if (!response.ok) return empty;

		// A PDF or an image has no <head> to read; don't download it to find out.
		const contentType = response.headers.get("content-type") ?? "";
		if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) return empty;

		// The final host after redirects — that is whose masthead the title carries.
		const host = URL.parse(response.url)?.hostname ?? parsed.hostname;
		return parseMetadata(await readCapped(response), host);
	} catch {
		// DNS failure, TLS error, timeout, malformed URL — all the same here.
		return empty;
	}
}
