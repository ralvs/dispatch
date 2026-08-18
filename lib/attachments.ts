/*
 * The rules for what may become a note attachment (docs/adr/0052). Pure — no
 * I/O, no server-only import — so the route, the service, and the tests all
 * share one answer and none of them has to spin up storage to ask.
 */

/** Matches the Server Action body cap in next.config.ts, and sits under R2's own limit. */
export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

export type AttachmentKind = "image" | "pdf" | "text";

/**
 * The allow-list, keyed by normalized content type. The extension is the one
 * we store under — never the one the client sent, which is why a `.jpeg` and a
 * `.jpg` both land as `.jpg`.
 */
const ALLOWED = {
	"image/jpeg": { ext: "jpg", kind: "image" },
	"image/png": { ext: "png", kind: "image" },
	"image/webp": { ext: "webp", kind: "image" },
	"image/gif": { ext: "gif", kind: "image" },
	"image/heic": { ext: "heic", kind: "image" },
	"image/heif": { ext: "heif", kind: "image" },
	"application/pdf": { ext: "pdf", kind: "pdf" },
	"text/plain": { ext: "txt", kind: "text" },
	"text/markdown": { ext: "md", kind: "text" },
} as const satisfies Record<string, { ext: string; kind: AttachmentKind }>;

export type AllowedContentType = keyof typeof ALLOWED;

/** Extension → content type, for the cases where the browser tells us nothing useful. */
const BY_EXTENSION: Record<string, AllowedContentType> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
	gif: "image/gif",
	heic: "image/heic",
	heif: "image/heif",
	pdf: "application/pdf",
	txt: "text/plain",
	md: "text/markdown",
	markdown: "text/markdown",
};

export function isAllowedContentType(value: string): value is AllowedContentType {
	return value in ALLOWED;
}

export function attachmentKind(contentType: AllowedContentType): AttachmentKind {
	return ALLOWED[contentType].kind;
}

export function extensionFor(contentType: AllowedContentType): string {
	return ALLOWED[contentType].ext;
}

export function fileExtension(filename: string): string {
	const dot = filename.lastIndexOf(".");
	if (dot <= 0 || dot === filename.length - 1) return "";
	return filename.slice(dot + 1).toLowerCase();
}

/**
 * What the browser calls a file is only a hint. `.md` in particular arrives as
 * `text/markdown`, `text/plain`, `application/octet-stream`, or an empty
 * string depending on the OS and the drag source, so the extension is the
 * tiebreaker whenever the declared type is absent or deliberately vague.
 *
 * Returns null when neither the declared type nor the extension is allowed.
 */
export function normalizeContentType(
	declared: string | null | undefined,
	filename: string,
): AllowedContentType | null {
	// Strip any `; charset=utf-8` the browser appended.
	const bare = (declared ?? "").split(";")[0].trim().toLowerCase();
	if (bare && bare !== "application/octet-stream" && isAllowedContentType(bare)) return bare;

	const byExt = BY_EXTENSION[fileExtension(filename)];
	if (byExt) return byExt;

	// A declared type we do not allow, with an extension we do not recognise.
	return null;
}

const MAGIC: Array<{ type: AllowedContentType; test: (b: Uint8Array) => boolean }> = [
	{ type: "application/pdf", test: (b) => ascii(b, 0, 5) === "%PDF-" },
	{ type: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
	{ type: "image/png", test: (b) => ascii(b, 1, 4) === "PNG" && b[0] === 0x89 },
	{ type: "image/gif", test: (b) => ascii(b, 0, 4) === "GIF8" },
	{ type: "image/webp", test: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP" },
	{ type: "image/heic", test: (b) => ascii(b, 4, 8) === "ftyp" && isHeicBrand(ascii(b, 8, 12)) },
	{ type: "image/heif", test: (b) => ascii(b, 4, 8) === "ftyp" && isHeicBrand(ascii(b, 8, 12)) },
];

function ascii(bytes: Uint8Array, start: number, end: number): string {
	return String.fromCharCode(...bytes.slice(start, end));
}

function isHeicBrand(brand: string): boolean {
	return ["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(brand);
}

/**
 * Reject a file whose bytes contradict its claimed type — a `.pdf` that is
 * really a script, say. Text is the deliberate exception: plain text has no
 * magic number, so it is accepted on extension alone (it is also the one type
 * here that cannot be executed by being served back).
 *
 * HEIC and HEIF share a container, so either brand satisfies either type.
 */
export function bytesMatchContentType(bytes: Uint8Array, contentType: AllowedContentType): boolean {
	if (attachmentKind(contentType) === "text") return true;
	if (bytes.length < 12) return false;
	const detected = MAGIC.filter((m) => m.test(bytes)).map((m) => m.type);
	if (detected.length === 0) return false;
	if (detected.includes(contentType)) return true;
	// heic/heif are one container under two names.
	const heifPair = new Set<string>(["image/heic", "image/heif"]);
	return heifPair.has(contentType) && detected.some((d) => heifPair.has(d));
}

/**
 * Where the bytes live. The client filename never enters the key — it is
 * attacker-controlled and would carry `../` straight into the object store —
 * so the name is preserved as metadata instead and the key is a fresh uuid.
 */
export function storageKey(noteId: string, contentType: AllowedContentType): string {
	return `notes/${noteId}/${crypto.randomUUID()}.${extensionFor(contentType)}`;
}

/** The prefix holding every file for one note. Used to sweep on note delete. */
export function noteStoragePrefix(noteId: string): string {
	return `notes/${noteId}/`;
}

/** The app-relative URL persisted on the attachment. Ours, never the provider's. */
export function mediaUrl(key: string): string {
	return `/api/media/${key}`;
}

const UNITS = ["B", "KB", "MB", "GB"];

/** Row label. One decimal above KB, none below — "847 KB", "2.4 MB". */
export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes < 0) return "";
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < UNITS.length - 1) {
		value /= 1024;
		unit += 1;
	}
	const rounded = unit === 0 ? Math.round(value) : Math.round(value * 10) / 10;
	return `${unit <= 1 ? Math.round(rounded) : rounded} ${UNITS[unit]}`;
}
