import "server-only";

// ─────────────────────────────────────────────────────────────────────────
// Link metadata fetch (docs/adr/0022). A shared URL arrives bare, so the
// reading list at /links used to be a wall of raw hrefs. This resolves a
// title, a one-line description and a preview image (docs/adr/0066) from the
// page's own <head>, or from the provider when it has an API (docs/adr/0026).
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

export type LinkMetadata = {
	title: string | null;
	description: string | null;
	/** Absolute https URL of a preview image. Hotlinked, never downloaded. */
	image: string | null;
};

const TIMEOUT_MS = 5_000;
const MAX_BYTES = 512 * 1024;
const TITLE_MAX = 500;
const DESCRIPTION_MAX = 5_000;
const IMAGE_MAX = 2_048;

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
 * An image URL the page can hotlink: absolute, https, and sane in length. A
 * relative og:image resolves against the page; an http one is dropped, since
 * it would be blocked as mixed content on an https page anyway.
 */
function cleanImage(raw: string | undefined, base?: string): string | null {
	if (!raw) return null;
	const resolved = URL.parse(decodeEntities(raw).trim(), base);
	if (resolved?.protocol !== "https:") return null;
	const href = resolved.toString();
	return href.length > IMAGE_MAX ? null : href;
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

/**
 * `base` is the page's final URL after redirects. Its host feeds the masthead
 * match; the whole URL resolves a relative og:image.
 */
export function parseMetadata(html: string, base?: string): LinkMetadata {
	const host = base ? URL.parse(base)?.hostname : undefined;
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

	const image =
		cleanImage(metaContent(head, "og:image:secure_url"), base) ??
		cleanImage(metaContent(head, "og:image"), base) ??
		cleanImage(metaContent(head, "twitter:image"), base);

	return { title, description, image };
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
		const { title, author_name, thumbnail_url } = body as {
			title?: unknown;
			author_name?: unknown;
			thumbnail_url?: unknown;
		};

		const cleanTitle = typeof title === "string" ? clean(title, TITLE_MAX) : null;
		if (!cleanTitle) return null;

		return {
			title: cleanTitle,
			description: typeof author_name === "string" ? clean(author_name, DESCRIPTION_MAX) : null,
			image: typeof thumbnail_url === "string" ? cleanImage(thumbnail_url) : null,
		};
	} catch {
		return null;
	}
}

// ─────────────────────────────────────────────────────────────────────────
// X / Twitter (docs/adr/0066). X's own head is readable but wrong for a
// reading list: the title is "Name (@handle) on X", the description keeps
// raw t.co links, and a long post has no description at all. FxTwitter's
// keyless API returns the post's full text with links expanded, the author,
// and the media — so it goes first, and the head is the fallback.
// ─────────────────────────────────────────────────────────────────────────

const X_HOSTS = new Set([
	"x.com",
	"www.x.com",
	"mobile.x.com",
	"m.x.com",
	"twitter.com",
	"www.twitter.com",
	"mobile.twitter.com",
	"m.twitter.com",
]);

function isXHost(host: string): boolean {
	return X_HOSTS.has(host.toLowerCase());
}

/**
 * `/{handle}/status/{id}` (or `/i/web/status/{id}`) → the FxTwitter API URL
 * for that post, or null. FxTwitter resolves a post by id whatever the handle.
 */
export function xStatusEndpoint(parsed: URL): string | null {
	if (!isXHost(parsed.hostname)) return null;
	const match = parsed.pathname.match(/^\/(\w{1,15}|i\/web)\/status(?:es)?\/(\d{1,25})(?:\/|$)/);
	if (!match?.[1] || !match[2]) return null;
	const handle = match[1] === "i/web" ? "i" : match[1];
	return `https://api.fxtwitter.com/${handle}/status/${match[2]}`;
}

const T_CO = /https:\/\/t\.co\/\w+/g;

/**
 * "Gregor Zunic (@gregpr07)". A display name with no letter or digit in it
 * (a lone "⃟") says nothing, so the handle stands alone.
 */
function xAuthor(name: string | null, handle: string | null): string | null {
	if (!handle) return name;
	return name && /[\p{L}\p{N}]/u.test(name) ? `${name} (@${handle})` : `@${handle}`;
}

type FxMedia = { all?: unknown };
type FxPost = {
	text?: unknown;
	author?: { name?: unknown; screen_name?: unknown };
	media?: FxMedia;
	quote?: { media?: FxMedia };
	card?: { image?: { url?: unknown } };
	article?: {
		title?: unknown;
		preview_text?: unknown;
		cover_media?: { media_info?: { original_img_url?: unknown } };
	};
};

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/** Line breaks carry meaning in a post (lists, a hook line), so they stay. */
function postText(raw: string | undefined): string | null {
	if (!raw) return null;
	return (
		decodeEntities(raw)
			// FxTwitter expands links already; a t.co that survives is a dead end.
			.replace(T_CO, "")
			.replace(/[^\S\n]+/g, " ")
			.replace(/\n{3,}/g, "\n\n")
			.trim()
			.slice(0, DESCRIPTION_MAX) || null
	);
}

/** A photo's own URL, or a video's thumbnail — a video's url is the mp4. */
function mediaImage(media: FxMedia | undefined): string | null {
	const first: { type?: unknown; url?: unknown; thumbnail_url?: unknown } | undefined =
		Array.isArray(media?.all) ? media.all[0] : undefined;
	const raw = first?.type === "photo" ? str(first.url) : str(first?.thumbnail_url);
	return cleanImage(raw);
}

/**
 * The picture a reader sees first: the post's own media, then the post it
 * quotes, then its link card, then a long-form article's cover.
 */
function postImage(post: FxPost): string | null {
	return (
		mediaImage(post.media) ??
		mediaImage(post.quote?.media) ??
		cleanImage(str(post.card?.image?.url)) ??
		cleanImage(str(post.article?.cover_media?.media_info?.original_img_url))
	);
}

/**
 * The pure half of the X provider: one FxTwitter response body in, metadata
 * out. Null when the body is not a post, so the caller falls back to the head.
 */
export function parseFxTwitter(body: unknown): LinkMetadata | null {
	if (typeof body !== "object" || body === null) return null;
	const post = (body as { tweet?: unknown }).tweet;
	if (typeof post !== "object" || post === null) return null;
	const { author, article } = post as FxPost;

	const name = clean(str(author?.name), TITLE_MAX);
	const title = xAuthor(name, str(author?.screen_name) ?? null);
	if (!title) return null;

	// A long-form X article has no post text; its title and opening stand in.
	const articleText = [str(article?.title), str(article?.preview_text)]
		.filter(Boolean)
		.join("\n\n");
	const description = postText(str((post as FxPost).text)) ?? postText(articleText);

	return { title, description, image: postImage(post as FxPost) };
}

async function fetchFxTwitter(endpoint: string): Promise<LinkMetadata | null> {
	try {
		const response = await fetch(endpoint, {
			redirect: "follow",
			signal: AbortSignal.timeout(TIMEOUT_MS),
			headers: { accept: "application/json" },
		});
		// 404 is a deleted or protected post; anything else, the service is down.
		if (!response.ok) return null;
		return parseFxTwitter(await response.json());
	} catch {
		return null;
	}
}

/**
 * When FxTwitter is down and X's own head is all there is, trim what makes it
 * cryptic: the " on X" tail on the title and the t.co links in the text.
 */
export function tidyXHead(meta: LinkMetadata): LinkMetadata {
	const title = meta.title?.replace(/\s+on (?:X|Twitter)$/, "") ?? null;
	const description = meta.description?.replace(T_CO, "").replace(/\s+/g, " ").trim() || null;
	return { ...meta, title, description };
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
 * Best-effort title/description/image for a shared URL. Never throws and never
 * rejects — an unreachable page yields `{title: null, description: null}` and
 * the link is stored bare, exactly as it was before this existed.
 */
export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
	const empty: LinkMetadata = { title: null, description: null, image: null };

	try {
		const parsed = new URL(url);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return empty;

		// A provider that answers about itself beats scraping its shell.
		const endpoint = oembedEndpoint(parsed);
		if (endpoint) {
			const oembed = await fetchOembed(endpoint);
			if (oembed) return oembed;
		}
		const xEndpoint = xStatusEndpoint(parsed);
		if (xEndpoint) {
			const post = await fetchFxTwitter(xEndpoint);
			if (post) return post;
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

		// The final URL after redirects — its host is whose masthead the title
		// carries, and a relative og:image is relative to it.
		const finalUrl = response.url || parsed.toString();
		const meta = parseMetadata(await readCapped(response), finalUrl);
		return isXHost(URL.parse(finalUrl)?.hostname ?? "") ? tidyXHead(meta) : meta;
	} catch {
		// DNS failure, TLS error, timeout, malformed URL — all the same here.
		return empty;
	}
}
